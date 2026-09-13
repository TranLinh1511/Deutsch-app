import { getDocs, setDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from './config';
import { sessCol, sessDoc, vocabCol, mastCol, flagCol } from './paths';
import { cacheGet, cacheSet } from '@/services/cache';
import type { Session } from '@/types/models';

// In-memory cache, mirrors _cache.sessions in index.html
let _sessionsCache: Session[] | null = null;

export function invalidateSessionsCache() {
  _sessionsCache = null;
}

/** index.html: dbGetAllSessions() */
export async function dbGetAllSessions(uid: string): Promise<Session[]> {
  if (_sessionsCache) return _sessionsCache;
  const cacheKey = 'cache_sessions_' + uid;
  try {
    const snap = await getDocs(query(sessCol(uid), orderBy('createdAt', 'asc')));
    const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Session);
    _sessionsCache = sessions;
    await cacheSet(cacheKey, sessions);
    return sessions;
  } catch (err) {
    const cached = await cacheGet<Session[]>(cacheKey);
    if (cached) {
      console.warn('[dbGetAllSessions] Firestore unavailable, using local cache', err);
      _sessionsCache = cached;
      return cached;
    }
    throw err;
  }
}

/** index.html: dbSaveSession(s) — creates or updates (setDoc merge:true) */
export async function dbSaveSession(uid: string, s: Session): Promise<void> {
  const data: Record<string, unknown> = { name: s.name, createdAt: s.createdAt || Date.now() };
  if (s.folderId !== undefined) data.folderId = s.folderId || null;
  await setDoc(sessDoc(uid, s.id), data, { merge: true });
  invalidateSessionsCache();
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
}
