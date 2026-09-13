import { collection, doc } from 'firebase/firestore';
import { db } from './config';

/**
 * Path helpers — identical Firestore structure to index.html
 * (users/{uid}/sessions/{sid}/vocabulary|mastered|flagged, users/{uid}/folders).
 * The original kept a module-level `_uid` set once after auth resolved;
 * here every function takes `uid` explicitly since RN services are stateless
 * (uid comes from AuthContext / DataStore, not a global).
 */
export const sessCol = (uid: string) => collection(db, 'users', uid, 'sessions');
export const sessDoc = (uid: string, sid: string) => doc(db, 'users', uid, 'sessions', sid);

export const vocabCol = (uid: string, sid: string) =>
  collection(db, 'users', uid, 'sessions', sid, 'vocabulary');
export const vocabDoc = (uid: string, sid: string, wid: string) =>
  doc(db, 'users', uid, 'sessions', sid, 'vocabulary', wid);

export const mastCol = (uid: string, sid: string) =>
  collection(db, 'users', uid, 'sessions', sid, 'mastered');
export const mastDoc = (uid: string, sid: string, wid: string) =>
  doc(db, 'users', uid, 'sessions', sid, 'mastered', wid);

export const flagCol = (uid: string, sid: string) =>
  collection(db, 'users', uid, 'sessions', sid, 'flagged');
export const flagDoc = (uid: string, sid: string, wid: string) =>
  doc(db, 'users', uid, 'sessions', sid, 'flagged', wid);

export const folderCol = (uid: string) => collection(db, 'users', uid, 'folders');
export const folderDoc = (uid: string, fid: string) => doc(db, 'users', uid, 'folders', fid);
