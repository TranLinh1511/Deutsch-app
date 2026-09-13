import type { Folder, Session } from '@/types/models';

export interface FolderTreeNode {
  folder: Folder;
  children: FolderTreeNode[];
  sessions: Session[];
}

export interface FolderTree {
  tree: FolderTreeNode[];
  unassigned: Session[];
}

/**
 * Builds a nested folder tree from the flat `folders`/`sessions` arrays,
 * following `Folder.parentId` (subfolders) and `Session.folderId`
 * (sessions placed directly inside a folder).
 *
 * Sessions whose `folderId` is null/undefined, or that point at a folder
 * that no longer exists, end up in `unassigned` (rendered at the sidebar
 * root, same as index.html's "no folder" section).
 */
/** So sánh tên kiểu "tự nhiên": số trong tên được so sánh như số (1 < 2 <
 *  ... < 10), không so theo từng ký tự như sort mặc định (vốn sẽ xếp
 *  "Bài 10" trước "Bài 2" vì '1' < '2'). */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' });
}

export function buildFolderTree(folders: Folder[], sessions: Session[]): FolderTree {
  const folderIds = new Set(folders.map((f) => f.id));

  const byParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const key = f.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(f);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.order - b.order);

  function build(parentId: string | null): FolderTreeNode[] {
    const children = byParent.get(parentId) || [];
    return children.map((f) => ({
      folder: f,
      children: build(f.id),
      sessions: sessions.filter((s) => s.folderId === f.id).sort((a, b) => naturalCompare(a.name, b.name)),
    }));
  }

  const tree = build(null);
  const unassigned = sessions
    .filter((s) => !s.folderId || !folderIds.has(s.folderId))
    .sort((a, b) => naturalCompare(a.name, b.name));
  return { tree, unassigned };
}

/** Returns the chain of ancestor folder ids (immediate parent first) for a given folder id. */
export function ancestorFolderIds(folders: Folder[], folderId: string | null | undefined): string[] {
  const ids: string[] = [];
  let current = folderId ? folders.find((f) => f.id === folderId) : undefined;
  while (current) {
    ids.push(current.id);
    current = current.parentId ? folders.find((f) => f.id === current!.parentId) : undefined;
  }
  return ids;
}
