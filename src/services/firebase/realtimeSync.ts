import { onSnapshot, query, orderBy, type Unsubscribe } from 'firebase/firestore';
import { vocabCol, mastCol, flagCol } from './paths';
import { cacheSet } from '@/services/cache';
import { setVocabCacheEntry } from './words';
import { setMasteredCacheEntry, setFlaggedCacheEntry } from './masteredFlagged';
import type { VocabWord } from '@/types/models';

export type RemoteChangeKind = 'vocab' | 'mastered' | 'flagged';
export type OnRemoteChange = (kind: RemoteChangeKind, sid: string) => void;

interface SessionListeners {
  vocab: Unsubscribe;
  mastered: Unsubscribe;
  flagged: Unsubscribe;
}

// mirrors _listeners = {} (sid -> unsubscribe fns)
const _listeners: Record<string, SessionListeners> = {};

/** index.html: _startSessionListeners(sid, onRemoteChange) */
function _startSessionListeners(uid: string, sid: string, onRemoteChange: OnRemoteChange) {
  if (_listeners[sid]) return;

  const vocabUnsub = onSnapshot(
    query(vocabCol(uid, sid), orderBy('sortOrder', 'asc')),
    { includeMetadataChanges: true },
    (snap) => {
      // hasPendingWrites=true → this event is our own local write, cache is
      // already current from the write path — skip re-render, same as original.
      if (snap.metadata.hasPendingWrites) return;
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VocabWord);
      setVocabCacheEntry(sid, data);
      cacheSet(`vocab_${sid}`, data);
      if (!snap.metadata.fromCache) onRemoteChange('vocab', sid);
    },
    (err) => console.warn('[onSnapshot vocab]', err)
  );

  const masteredUnsub = onSnapshot(
    mastCol(uid, sid),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      const ids = new Set(snap.docs.map((d) => d.id));
      setMasteredCacheEntry(sid, ids);
      cacheSet('cache_mastered_' + sid, [...ids]);
      if (!snap.metadata.fromCache) onRemoteChange('mastered', sid);
    },
    (err) => console.warn('[onSnapshot mastered]', err)
  );

  const flaggedUnsub = onSnapshot(
    flagCol(uid, sid),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      const ids = new Set(snap.docs.map((d) => d.id));
      setFlaggedCacheEntry(sid, ids);
      cacheSet('cache_flagged_' + sid, [...ids]);
      if (!snap.metadata.fromCache) onRemoteChange('flagged', sid);
    },
    (err) => console.warn('[onSnapshot flagged]', err)
  );

  _listeners[sid] = { vocab: vocabUnsub, mastered: masteredUnsub, flagged: flaggedUnsub };
}

/** index.html: _stopSessionListeners(sid) */
function _stopSessionListeners(sid: string) {
  const l = _listeners[sid];
  if (!l) return;
  l.vocab();
  l.mastered();
  l.flagged();
  delete _listeners[sid];
}

/** index.html: initRealtimeSync(sid, onRemoteChange) */
export function initRealtimeSync(uid: string, sid: string, onRemoteChange: OnRemoteChange) {
  _startSessionListeners(uid, sid, onRemoteChange);
}

/** index.html: switchRealtimeSession(newSid, onRemoteChange) — stops all others, keeps only newSid live */
export function switchRealtimeSession(uid: string, newSid: string, onRemoteChange: OnRemoteChange) {
  Object.keys(_listeners).forEach((sid) => {
    if (sid !== newSid) _stopSessionListeners(sid);
  });
  _startSessionListeners(uid, newSid, onRemoteChange);
}

/** index.html: addRealtimeSession(sid, onRemoteChange) — used for merged-session practice (keeps multiple live) */
export function addRealtimeSession(uid: string, sid: string, onRemoteChange: OnRemoteChange) {
  _startSessionListeners(uid, sid, onRemoteChange);
}

export function stopAllRealtimeSync() {
  Object.keys(_listeners).forEach(_stopSessionListeners);
}
