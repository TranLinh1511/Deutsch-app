import { getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { mastCol, mastDoc, flagCol, flagDoc } from './paths';
import { cacheGet, cacheSet } from '@/services/cache';

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

/** index.html: dbGetMastered(sid) */
export async function dbGetMastered(uid: string, sid: string): Promise<Set<string>> {
  if (_masteredCache[sid]) return _masteredCache[sid];
  const cacheKey = 'cache_mastered_' + sid;
  try {
    const snap = await getDocs(mastCol(uid, sid));
    const ids = new Set(snap.docs.map((d) => d.id));
    _masteredCache[sid] = ids;
    await cacheSet(cacheKey, [...ids]);
    return ids;
  } catch {
    const cached = await cacheGet<string[]>(cacheKey);
    _masteredCache[sid] = new Set(cached || []);
    return _masteredCache[sid];
  }
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
export async function dbGetFlagged(uid: string, sid: string): Promise<Set<string>> {
  if (_flaggedCache[sid]) return _flaggedCache[sid];
  const cacheKey = 'cache_flagged_' + sid;
  try {
    const snap = await getDocs(flagCol(uid, sid));
    const ids = new Set(snap.docs.map((d) => d.id));
    _flaggedCache[sid] = ids;
    await cacheSet(cacheKey, [...ids]);
    return ids;
  } catch {
    const cached = await cacheGet<string[]>(cacheKey);
    _flaggedCache[sid] = new Set(cached || []);
    return _flaggedCache[sid];
  }
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
