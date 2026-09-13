import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { clearStaleVocabCaches, cacheGet, cacheSet } from '@/services/cache';
import { dbGetAllSessions, dbSaveSession, dbDeleteSession } from '@/services/firebase/sessions';
import {
  dbGetSessionVocab,
  dbAddWord,
  dbUpdateWord,
  dbDeleteWord,
  getVocabCacheEntry,
} from '@/services/firebase/words';
import {
  dbGetMastered,
  dbGetFlagged,
  dbMarkMastered,
  dbUnmarkMastered,
  dbMarkFlagged,
  dbUnmarkFlagged,
} from '@/services/firebase/masteredFlagged';
import {
  getFolders,
  createFolder as fbCreateFolder,
  renameFolder as fbRenameFolder,
  deleteFolder as fbDeleteFolder,
  moveFolder as fbMoveFolder,
  setSessionFolder as fbSetSessionFolder,
} from '@/services/firebase/folders';
import { initRealtimeSync, switchRealtimeSession } from '@/services/firebase/realtimeSync';
import type { Session, Folder, VocabWord } from '@/types/models';

/**
 * Data-layer store, wrapping the Firestore services above — the RN
 * equivalent of index.html's module-level state (sessions[], currentSessionId,
 * masteredIds, flaggedIds) plus bootstrap()/switchSession()/createNewSession().
 * UI-only concerns (renderSidebar, practice list building, exercise state)
 * are intentionally NOT here — those come in Phase 4/5.
 */
interface DataStoreValue {
  isLoading: boolean;
  sessions: Session[];
  folders: Folder[];
  currentSessionId: string | null;
  vocab: VocabWord[];
  masteredIds: Set<string>;
  flaggedIds: Set<string>;

  // "Gộp phiên" (merge sessions) — shared here (not just inside the practice
  // engine) so any screen, including the sidebar, can see the full combined
  // vocabulary while merge mode is active.
  source: 'session' | 'merged';
  setSource: (s: 'session' | 'merged') => void;
  mergedSessionIds: string[];
  setMergedSessionIds: (updater: string[] | ((prev: string[]) => string[])) => void;
  mergedVocab: (VocabWord & { _sessId: string })[];
  mergedMasteredIds: Set<string>;
  mergedFlaggedIds: Set<string>;
  refreshMergedVocab: () => void;
  toggleMasteredForSession: (sid: string, wordId: string) => Promise<void>;
  toggleFlaggedForSession: (sid: string, wordId: string) => Promise<void>;
  updateWordForSession: (sid: string, word: VocabWord) => Promise<void>;
  deleteWordForSession: (sid: string, id: string) => Promise<void>;

  switchSession: (id: string) => Promise<void>;
  createSession: (name: string) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, name: string) => Promise<void>;
  moveSessionToFolder: (id: string, folderId: string | null) => Promise<void>;

  createFolder: (name: string, parentId?: string | null) => Promise<Folder>;
  renameFolder: (fid: string, name: string) => Promise<void>;
  deleteFolder: (fid: string) => Promise<void>;
  moveFolder: (fid: string, parentId: string | null) => Promise<void>;
  refreshFolders: () => Promise<void>;

  addWord: (word: VocabWord, order: number) => Promise<void>;
  updateWord: (word: VocabWord) => Promise<void>;
  deleteWord: (id: string) => Promise<void>;
  refreshVocab: () => Promise<void>;

  toggleMastered: (wordId: string) => Promise<void>;
  toggleFlagged: (wordId: string) => Promise<void>;
}

const DataStoreContext = createContext<DataStoreValue | null>(null);

const CURRENT_SESSION_KEY = (uid: string) => 'currentSessionId_' + uid;
// "Gộp phiên" (merge mode): TRƯỚC ĐÂY source/mergedSessionIds chỉ là state
// trong bộ nhớ (useState thường), không hề persist — nên chỉ cần thoát màn
// hình/tắt-mở lại app (component DataStoreProvider bị unmount/remount, hoặc
// tiến trình JS bị hệ điều hành thu hồi rồi khởi động lại) là mất sạch chế
// độ gộp đang bật, quay về phiên đơn lẻ. Giờ lưu lại giống hệt cách
// CURRENT_SESSION_KEY ở trên đang làm, để mở lại app vẫn giữ đúng trạng thái
// gộp phiên (bật/tắt + danh sách phiên đã chọn gộp) như trước khi thoát.
const MERGE_STATE_KEY = (uid: string) => 'mergeState_' + uid;

// index.html: buildFullList's seed word for a brand-new account (bootstrap())
const SEED_WORD: VocabWord = {
  id: 'seed_der_tisch',
  originalGerman: 'der Tisch',
  mainGerman: 'der Tisch',
  meaning: 'cái bàn',
  wordType: 'n',
  example: 'Der Tisch ist groß.',
};

export function DataStoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [vocab, setVocab] = useState<VocabWord[]>([]);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  const [source, setSource] = useState<'session' | 'merged'>('session');
  const [mergedSessionIds, setMergedSessionIds] = useState<string[]>([]);
  const [mergedVocab, setMergedVocab] = useState<(VocabWord & { _sessId: string })[]>([]);
  const [mergedMasteredIds, setMergedMasteredIds] = useState<Set<string>>(new Set());
  const [mergedFlaggedIds, setMergedFlaggedIds] = useState<Set<string>>(new Set());
  const [mergedRefreshTick, setMergedRefreshTick] = useState(0);
  const refreshMergedVocab = useCallback(() => setMergedRefreshTick((t) => t + 1), []);

  const uidRef = useRef<string | null>(null);
  uidRef.current = user?.uid ?? null;

  const onRemoteUpdate = useCallback(
    async (kind: 'vocab' | 'mastered' | 'flagged', sid: string) => {
      const uid = uidRef.current;
      if (!uid || sid !== currentSessionId) return;
      if (kind === 'vocab') setVocab(getVocabCacheEntry(sid) ?? (await dbGetSessionVocab(uid, sid)));
      if (kind === 'mastered') setMasteredIds(await dbGetMastered(uid, sid));
      if (kind === 'flagged') setFlaggedIds(await dbGetFlagged(uid, sid));
    },
    [currentSessionId]
  );

  // ---- bootstrap() equivalent ----
  useEffect(() => {
    if (!user) {
      setSessions([]);
      setFolders([]);
      setCurrentSessionId(null);
      setVocab([]);
      setMasteredIds(new Set());
      setFlaggedIds(new Set());
      setIsLoading(true);
      // Đăng xuất → về lại trạng thái mặc định (không gộp) để không lẫn
      // sang tài khoản khác đăng nhập sau đó; trạng thái gộp phiên đã lưu
      // của TÀI KHOẢN NÀY vẫn còn nguyên trong AsyncStorage (khoá theo uid,
      // xem MERGE_STATE_KEY) và sẽ được nạp lại đúng như cũ ở dưới khi họ
      // đăng nhập lại.
      setSource('session');
      setMergedSessionIds([]);
      return;
    }

    (async () => {
      setIsLoading(true);
      await clearStaleVocabCaches();

      let sess = await dbGetAllSessions(user.uid);
      if (!sess.length) {
        const def: Session = { id: 'sess_' + Date.now(), name: 'Mặc định', createdAt: Date.now() };
        await dbSaveSession(user.uid, def);
        await dbAddWord(user.uid, def.id, SEED_WORD, 0);
        sess = [def];
      }
      setSessions(sess);

      const foldersData = await getFolders(user.uid);
      setFolders(foldersData);

      const savedId = await cacheGet<string>(CURRENT_SESSION_KEY(user.uid));
      const initialId = sess.find((s) => s.id === savedId)?.id ?? sess[0].id;
      await activateSession(user.uid, initialId);

      // Nạp lại trạng thái "Gộp phiên" đã lưu từ lần trước (nếu có) — lọc
      // bỏ những id phiên không còn tồn tại nữa (đã bị xoá) để tránh gộp
      // nhầm phiên ma. Nếu sau khi lọc không còn phiên hợp lệ nào thì coi
      // như chưa từng gộp, giữ nguyên chế độ phiên đơn lẻ.
      const savedMerge = await cacheGet<{ source: 'session' | 'merged'; mergedSessionIds: string[] }>(
        MERGE_STATE_KEY(user.uid)
      );
      if (savedMerge?.source === 'merged') {
        const validIds = savedMerge.mergedSessionIds.filter((id) => sess.some((s) => s.id === id));
        if (validIds.length) {
          setMergedSessionIds(validIds);
          setSource('merged');
        }
      }

      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Lưu lại trạng thái "Gộp phiên" mỗi khi đổi (bật/tắt hoặc đổi danh sách
  // phiên đã chọn) — xem MERGE_STATE_KEY ở trên vì sao cần lưu.
  // Chờ isLoading === false (bootstrap ở trên đã đọc xong savedMerge và áp
  // dụng lại) mới bắt đầu lưu — nếu không, effect này có thể chạy VÀ ghi đè
  // giá trị mặc định (source: 'session', mergedSessionIds: []) lên đúng lúc
  // bootstrap còn đang đọc dữ liệu cũ lên (2 effect chạy gần như cùng lúc
  // khi mount), xoá mất trạng thái đã lưu trước khi kịp khôi phục.
  useEffect(() => {
    if (!user || isLoading) return;
    cacheSet(MERGE_STATE_KEY(user.uid), { source, mergedSessionIds });
  }, [user, isLoading, source, mergedSessionIds]);

  // "Gộp phiên" — while merge mode is active, fetch + combine vocab/mastered/
  // flagged from every merged session so the sidebar and the "Chọn từ luyện
  // tập" modal can show the full pool, not just the currently active session.
  useEffect(() => {
    if (!user) return;
    if (source !== 'merged') {
      setMergedVocab([]);
      setMergedMasteredIds(new Set());
      setMergedFlaggedIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const sessIds = mergedSessionIds.length ? mergedSessionIds : currentSessionId ? [currentSessionId] : [];
      const allWords: (VocabWord & { _sessId: string })[] = [];
      const allMastered = new Set<string>();
      const allFlagged = new Set<string>();
      for (const sid of sessIds) {
        // eslint-disable-next-line no-await-in-loop
        const [v, m, f] = await Promise.all([
          dbGetSessionVocab(user.uid, sid),
          dbGetMastered(user.uid, sid),
          dbGetFlagged(user.uid, sid),
        ]);
        v.forEach((w) => allWords.push({ ...w, _sessId: sid }));
        m.forEach((id) => allMastered.add(id));
        f.forEach((id) => allFlagged.add(id));
      }
      if (cancelled) return;
      setMergedVocab(allWords);
      setMergedMasteredIds(allMastered);
      setMergedFlaggedIds(allFlagged);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, source, mergedSessionIds, currentSessionId, mergedRefreshTick]);

  async function activateSession(uid: string, sid: string) {
    setCurrentSessionId(sid);
    const [v, m, f] = await Promise.all([
      dbGetSessionVocab(uid, sid),
      dbGetMastered(uid, sid),
      dbGetFlagged(uid, sid),
    ]);
    setVocab(v);
    setMasteredIds(m);
    setFlaggedIds(f);
    switchRealtimeSession(uid, sid, onRemoteUpdate);
    await cacheSet(CURRENT_SESSION_KEY(uid), sid);
  }

  // ---- switchSession() ----
  const switchSession = useCallback(
    async (id: string) => {
      if (!user) return;
      await activateSession(user.uid, id);
    },
    [user]
  );

  // ---- createNewSession() ----
  const createSession = useCallback(
    async (name: string) => {
      if (!user) throw new Error('no user');
      const ns: Session = { id: 'sess_' + Date.now(), name, createdAt: Date.now() };
      await dbSaveSession(user.uid, ns);
      setSessions((prev) => [...prev, ns]);
      await activateSession(user.uid, ns.id);
      return ns;
    },
    [user]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (!user) return;
      await dbDeleteSession(user.uid, id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      // Phiên vừa xoá có thể đang nằm trong danh sách "Gộp phiên" — bỏ nó ra
      // luôn, tránh lần fetch mergedVocab kế tiếp vẫn cố truy vấn 1 phiên đã
      // không còn tồn tại.
      setMergedSessionIds((prev) => prev.filter((sid) => sid !== id));
      if (currentSessionId === id) {
        const remaining = sessions.filter((s) => s.id !== id);
        if (remaining[0]) await activateSession(user.uid, remaining[0].id);
      }
    },
    [user, currentSessionId, sessions]
  );

  const renameSession = useCallback(
    async (id: string, name: string) => {
      if (!user) return;
      const s = sessions.find((x) => x.id === id);
      if (!s) return;
      const updated = { ...s, name };
      await dbSaveSession(user.uid, updated);
      setSessions((prev) => prev.map((x) => (x.id === id ? updated : x)));
    },
    [user, sessions]
  );

  const moveSessionToFolder = useCallback(
    async (id: string, folderId: string | null) => {
      if (!user) return;
      await fbSetSessionFolder(user.uid, id, folderId);
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, folderId } : s)));
    },
    [user]
  );

  // ---- Folders ----
  const refreshFolders = useCallback(async () => {
    if (!user) return;
    setFolders(await getFolders(user.uid));
  }, [user]);

  const createFolderAction = useCallback(
    async (name: string, parentId: string | null = null) => {
      if (!user) throw new Error('no user');
      const f = await fbCreateFolder(user.uid, name, parentId);
      setFolders((prev) => [...prev, f]);
      return f;
    },
    [user]
  );

  const renameFolderAction = useCallback(
    async (fid: string, name: string) => {
      if (!user) return;
      await fbRenameFolder(user.uid, fid, name);
      setFolders((prev) => prev.map((f) => (f.id === fid ? { ...f, name } : f)));
    },
    [user]
  );

  const deleteFolderAction = useCallback(
    async (fid: string) => {
      if (!user) return;
      await fbDeleteFolder(user.uid, fid);
      setFolders((prev) => prev.filter((f) => f.id !== fid));
    },
    [user]
  );

  const moveFolderAction = useCallback(
    async (fid: string, parentId: string | null) => {
      if (!user) return;
      await fbMoveFolder(user.uid, fid, parentId);
      setFolders((prev) => prev.map((f) => (f.id === fid ? { ...f, parentId } : f)));
    },
    [user]
  );

  // ---- Words ----
  const refreshVocab = useCallback(async () => {
    if (!user || !currentSessionId) return;
    setVocab(await dbGetSessionVocab(user.uid, currentSessionId));
  }, [user, currentSessionId]);

  const addWord = useCallback(
    async (word: VocabWord, order: number) => {
      if (!user || !currentSessionId) return;
      await dbAddWord(user.uid, currentSessionId, word, order);
      setVocab((prev) => [...prev, { ...word, sortOrder: order }]);
    },
    [user, currentSessionId]
  );

  const updateWord = useCallback(
    async (word: VocabWord) => {
      if (!user || !currentSessionId) return;
      await dbUpdateWord(
        user.uid,
        currentSessionId,
        word.id,
        word.originalGerman,
        word.mainGerman,
        word.meaning,
        word.wordType,
        word.example || ''
      );
      setVocab((prev) => prev.map((w) => (w.id === word.id ? word : w)));
    },
    [user, currentSessionId]
  );

  const deleteWord = useCallback(
    async (id: string) => {
      if (!user || !currentSessionId) return;
      await dbDeleteWord(user.uid, currentSessionId, id);
      setVocab((prev) => prev.filter((w) => w.id !== id));
    },
    [user, currentSessionId]
  );

  // ---- Mastered / Flagged toggles (masterCurrentWord / toggleFlagCurrentWord equivalents) ----
  const toggleMastered = useCallback(
    async (wordId: string) => {
      if (!user || !currentSessionId) return;
      if (masteredIds.has(wordId)) {
        await dbUnmarkMastered(user.uid, currentSessionId, wordId);
        setMasteredIds((prev) => {
          const next = new Set(prev);
          next.delete(wordId);
          return next;
        });
      } else {
        await dbMarkMastered(user.uid, currentSessionId, wordId);
        setMasteredIds((prev) => new Set(prev).add(wordId));
      }
    },
    [user, currentSessionId, masteredIds]
  );

  const toggleFlagged = useCallback(
    async (wordId: string) => {
      if (!user || !currentSessionId) return;
      if (flaggedIds.has(wordId)) {
        await dbUnmarkFlagged(user.uid, currentSessionId, wordId);
        setFlaggedIds((prev) => {
          const next = new Set(prev);
          next.delete(wordId);
          return next;
        });
      } else {
        await dbMarkFlagged(user.uid, currentSessionId, wordId);
        setFlaggedIds((prev) => new Set(prev).add(wordId));
      }
    },
    [user, currentSessionId, flaggedIds]
  );

  // Generalized variants that can act on a word belonging to ANY merged
  // session (not just currentSessionId) — used by the sidebar and the
  // practice engine while "Gộp phiên" (merge mode) is active.
  const toggleMasteredForSession = useCallback(
    async (sid: string, wordId: string) => {
      if (!user) return;
      if (sid === currentSessionId) {
        await toggleMastered(wordId);
        refreshMergedVocab();
        return;
      }
      if (mergedMasteredIds.has(wordId)) await dbUnmarkMastered(user.uid, sid, wordId);
      else await dbMarkMastered(user.uid, sid, wordId);
      refreshMergedVocab();
    },
    [user, currentSessionId, mergedMasteredIds, toggleMastered, refreshMergedVocab]
  );

  const toggleFlaggedForSession = useCallback(
    async (sid: string, wordId: string) => {
      if (!user) return;
      if (sid === currentSessionId) {
        await toggleFlagged(wordId);
        refreshMergedVocab();
        return;
      }
      if (mergedFlaggedIds.has(wordId)) await dbUnmarkFlagged(user.uid, sid, wordId);
      else await dbMarkFlagged(user.uid, sid, wordId);
      refreshMergedVocab();
    },
    [user, currentSessionId, mergedFlaggedIds, toggleFlagged, refreshMergedVocab]
  );

  const updateWordForSession = useCallback(
    async (sid: string, word: VocabWord) => {
      if (!user) return;
      if (sid === currentSessionId) {
        await updateWord(word);
        refreshMergedVocab();
        return;
      }
      await dbUpdateWord(user.uid, sid, word.id, word.originalGerman, word.mainGerman, word.meaning, word.wordType, word.example || '');
      refreshMergedVocab();
    },
    [user, currentSessionId, updateWord, refreshMergedVocab]
  );

  const deleteWordForSession = useCallback(
    async (sid: string, id: string) => {
      if (!user) return;
      if (sid === currentSessionId) {
        await deleteWord(id);
        refreshMergedVocab();
        return;
      }
      await dbDeleteWord(user.uid, sid, id);
      refreshMergedVocab();
    },
    [user, currentSessionId, deleteWord, refreshMergedVocab]
  );

  const value: DataStoreValue = {
    isLoading,
    sessions,
    folders,
    currentSessionId,
    vocab,
    masteredIds,
    flaggedIds,
    source,
    setSource,
    mergedSessionIds,
    setMergedSessionIds,
    mergedVocab,
    mergedMasteredIds,
    mergedFlaggedIds,
    refreshMergedVocab,
    toggleMasteredForSession,
    toggleFlaggedForSession,
    updateWordForSession,
    deleteWordForSession,
    switchSession,
    createSession,
    deleteSession,
    renameSession,
    moveSessionToFolder,
    createFolder: createFolderAction,
    renameFolder: renameFolderAction,
    deleteFolder: deleteFolderAction,
    moveFolder: moveFolderAction,
    refreshFolders,
    addWord,
    updateWord,
    deleteWord,
    refreshVocab,
    toggleMastered,
    toggleFlagged,
  };

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}

export function useDataStore() {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error('useDataStore must be used within DataStoreProvider');
  return ctx;
}
