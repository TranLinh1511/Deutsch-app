import { getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { folderCol, folderDoc } from './paths';
import { cacheGet } from '@/services/cache';
import { dbGetAllSessions, dbSaveSession } from './sessions';
import type { Folder } from '@/types/models';

// In-memory cache, mirrors _cache.folders
let _foldersCache: Folder[] | null = null;

function invalidateFoldersCache() {
  _foldersCache = null;
}

/** index.html: getFolders() */
export async function getFolders(uid: string): Promise<Folder[]> {
  if (_foldersCache) return _foldersCache;
  try {
    const snap = await getDocs(query(folderCol(uid), orderBy('order')));
    const folders = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Folder);
    _foldersCache = folders;
    return folders;
  } catch {
    // fallback to local cache for offline (mirrors localStorage "sessionFolders")
    return (await cacheGet<Folder[]>('sessionFolders')) || [];
  }
}

/** index.html: createFolder(name, parentId=null) */
export async function createFolder(uid: string, name: string, parentId: string | null = null): Promise<Folder> {
  const folders = await getFolders(uid);
  const f: Folder = { id: 'folder_' + Date.now(), name, order: folders.length, parentId: parentId || null };
  await setDoc(folderDoc(uid, f.id), { name: f.name, order: f.order, parentId: f.parentId });
  invalidateFoldersCache();
  return f;
}

/** index.html: renameFolder(fid, name) */
export async function renameFolder(uid: string, fid: string, name: string): Promise<void> {
  await setDoc(folderDoc(uid, fid), { name }, { merge: true });
  invalidateFoldersCache();
}

/** index.html: deleteFolder(fid) */
export async function deleteFolder(uid: string, fid: string): Promise<void> {
  await deleteDoc(folderDoc(uid, fid));
  invalidateFoldersCache();
}

/** Chuyển thư mục sang làm con của một thư mục khác (hoặc lên gốc nếu parentId=null). */
export async function moveFolder(uid: string, fid: string, parentId: string | null): Promise<void> {
  await setDoc(folderDoc(uid, fid), { parentId: parentId || null }, { merge: true });
  invalidateFoldersCache();
}

/** index.html: setSessionFolder(sessId, folderId) */
export async function setSessionFolder(uid: string, sessId: string, folderId: string | null): Promise<void> {
  const sessions = await dbGetAllSessions(uid);
  const sess = sessions.find((s) => s.id === sessId);
  if (!sess) return;
  await dbSaveSession(uid, { ...sess, folderId: folderId || null });
}
