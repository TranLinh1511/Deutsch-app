import { getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { mastCol, mastDoc, flagCol, flagDoc } from './paths';
import { cacheGet, cacheSet } from '@/services/cache';
import { emitRevalidated, type RevalidateKind } from './revalidate';

// In-memory caches, mirror _cache.mastered / _cache.flagged (sid -> Set<wordId>)
const _masteredCache: Record<string, Set<string>> = {};
const _flaggedCache: Record<string, Set<string>> = {};

export function getMasteredCacheEntry(sid: string) {
  return _masteredCache[sid];
}
export function getFlaggedCacheEntry(sid: string) {
  return _flaggedCache[sid];
}
export function setMasteredCacheEntry(sid: string, ids: Set<string>) {
  _masteredCache[sid] = ids;
}
export function setFlaggedCacheEntry(sid: string, ids: Set<string>) {
  _flaggedCache[sid] = ids;
}

/**
 * Stale-while-revalidate: có bộ nhớ đệm (RAM hoặc AsyncStorage) thì trả về
 * NGAY, rồi làm tươi từ Firestore ở nền. Trước đây luôn chờ getDocs qua
 * mạng mới trả lời → màn hình khởi động phải đợi thêm 1 vòng mạng cho mỗi
 * phiên × 2 (mastered + flagged).
 */
async function loadIdSet(
  uid: string,
  sid: string,
  memory: Record<string, Set<string>>,
  col: (uid: string, sid: string) => ReturnType<typeof mastCol>,
  cacheKey: string,
  kind: RevalidateKind
): Promise<Set<string>> {
  if (memory[sid]) return memory[sid];

  const fetchFresh = async () => {
    const snap = await getDocs(col(uid, sid));
    const ids = new Set(snap.docs.map((d) => d.id));
    const before = memory[sid];
    memory[sid] = ids;
    await cacheSet(cacheKey, [...ids]);
    if (before && (before.size !== ids.size || [...ids].some((id) => !before.has(id)))) emitRevalidated(kind, sid);
    return ids;
  };

  const cached = await cacheGet<string[]>(cacheKey);
  if (cached) {
    memory[sid] = new Set(cached);
    fetchFresh().catch(() => {}); // làm tươi nền; realtime listener sẽ báo UI nếu có thay đổi
    return memory[sid];
  }
  try {
    return await fetchFresh();
  } catch {
    memory[sid] = new Set();
    return memory[sid];
  }
}

/** index.html: dbGetMastered(sid) */
export function dbGetMastered(uid: string, sid: string): Promise<Set<string>> {
  return loadIdSet(uid, sid, _masteredCache, mastCol, 'cache_mastered_' + sid, 'mastered');
}

/** index.html: dbMarkMastered(sid, wid) */
export async function dbMarkMastered(uid: string, sid: string, wid: string): Promise<void> {
  await setDoc(mastDoc(uid, sid, wid), { masteredAt: Date.now() });
  _masteredCache[sid]?.add(wid);
}

/** index.html: dbUnmarkMastered(sid, wid) */
export async function dbUnmarkMastered(uid: string, sid: string, wid: string): Promise<void> {
  await deleteDoc(mastDoc(uid, sid, wid));
  _masteredCache[sid]?.delete(wid);
}

/** index.html: dbGetFlagged(sid) */
export function dbGetFlagged(uid: string, sid: string): Promise<Set<string>> {
  return loadIdSet(uid, sid, _flaggedCache, flagCol, 'cache_flagged_' + sid, 'flagged');
}

/** index.html: dbMarkFlagged(sid, wid) */
export async function dbMarkFlagged(uid: string, sid: string, wid: string): Promise<void> {
  await setDoc(flagDoc(uid, sid, wid), { flaggedAt: Date.now() });
  _flaggedCache[sid]?.add(wid);
}

/** index.html: dbUnmarkFlagged(sid, wid) */
export async function dbUnmarkFlagged(uid: string, sid: string, wid: string): Promise<void> {
  await deleteDoc(flagDoc(uid, sid, wid));
  _flaggedCache[sid]?.delete(wid);
}
