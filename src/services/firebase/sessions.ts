import { getDocs, setDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from './config';
import { sessCol, sessDoc, vocabCol, mastCol, flagCol } from './paths';
import { cacheGet, cacheSet, cacheRemove } from '@/services/cache';
import type { Session } from '@/types/models';
import { emitRevalidated } from './revalidate';

// In-memory cache, mirrors _cache.sessions in index.html
let _sessionsCache: Session[] | null = null;

export function invalidateSessionsCache() {
  _sessionsCache = null;
}

/**
 * index.html: dbGetAllSessions()
 * Stale-while-revalidate: có danh sách phiên trong AsyncStorage thì trả về
 * ngay (app mở lên tức thì), rồi làm tươi từ Firestore ở nền và báo
 * emitRevalidated('sessions') nếu khác. Chỉ lần đầu tiên mới phải chờ mạng.
 */
export async function dbGetAllSessions(uid: string): Promise<Session[]> {
  if (_sessionsCache) return _sessionsCache;
  const cacheKey = 'cache_sessions_' + uid;

  const fetchFresh = async (): Promise<Session[]> => {
    const snap = await getDocs(query(sessCol(uid), orderBy('createdAt', 'asc')));
    const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Session);
    const before = _sessionsCache;
    _sessionsCache = sessions;
    await cacheSet(cacheKey, sessions);
    if (before && JSON.stringify(before) !== JSON.stringify(sessions)) emitRevalidated('sessions', '');
    return sessions;
  };

  const cached = await cacheGet<Session[]>(cacheKey);
  if (cached && cached.length) {
    _sessionsCache = cached;
    fetchFresh().catch((err) => console.warn('[dbGetAllSessions] revalidate failed', err));
    return cached;
  }
  return fetchFresh();
}

/** index.html: dbSaveSession(s) — creates or updates (setDoc merge:true) */
export async function dbSaveSession(uid: string, s: Session): Promise<void> {
  const data: Record<string, unknown> = { name: s.name, createdAt: s.createdAt || Date.now() };
  if (s.folderId !== undefined) data.folderId = s.folderId || null;
  await setDoc(sessDoc(uid, s.id), data, { merge: true });
  invalidateSessionsCache();
  await cacheRemove('cache_sessions_' + uid); // tránh lần mở sau đọc lại danh sách phiên cũ
}

/** index.html: dbDeleteSession(sid) — batch-deletes vocab/mastered/flagged subcollections + the session doc */
export async function dbDeleteSession(uid: string, sid: string): Promise<void> {
  const [v, m, f] = await Promise.all([
    getDocs(vocabCol(uid, sid)),
    getDocs(mastCol(uid, sid)),
    getDocs(flagCol(uid, sid)),
  ]);
  const batch = writeBatch(db);
  [...v.docs, ...m.docs, ...f.docs].forEach((d) => batch.delete(d.ref));
  batch.delete(sessDoc(uid, sid));
  await batch.commit();
  invalidateSessionsCache();
  await cacheRemove('cache_sessions_' + uid);
}
