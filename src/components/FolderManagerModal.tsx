import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import type { ThemeColors } from '@/theme/theme';
import { useDataStore } from '@/store/DataStore';
import { useDialogs } from '@/store/DialogsContext';
import { useToast } from '@/store/ToastContext';
import { useAuth } from '@/store/AuthContext';
import BottomSheetModal from './BottomSheetModal';
import Icon, { IconProps } from './Icon';
import { buildFolderTree, type FolderTreeNode } from '@/utils/folderTree';
import type { Folder, Session } from '@/types/models';
import type { PracticeEngine } from '@/hooks/usePracticeEngine';
import { exportSessionsToJsonFile, exportWordsToExcel, exportSessionsToExcel } from '@/services/importExport';
import { dbGetSessionVocab } from '@/services/firebase/words';

/**
 * Checklist C: quản lý thư mục — tạo/đổi tên/xoá thư mục (kể cả thư mục
 * con), gán phiên vào thư mục. Maps renderFolderModal() in index.html.
 *
 * Rebuilt as a real hierarchical tree (Folder.parentId) with per-folder
 * expand/collapse, instead of a flat folder list — matches the desktop
 * "Quản lý thư mục" nesting (Schritte plus > A1 > Bài 7...).
 *
 * Also hosts the "Gộp phiên" toggle (nguồn câu hỏi đã được chuyển từ Cài
 * đặt sang đây): khi bật, các thẻ phiên chuyển sang chế độ chọn nhiều
 * (checkbox) để gộp vào engine.mergedSessionIds thay vì chuyển phiên; khi
 * tắt, quay lại nguồn là phiên đang mở.
 */
interface FolderManagerModalProps {
  visible: boolean;
  onClose: () => void;
  engine: PracticeEngine;
}

export default function FolderManagerModal({ visible, onClose, engine }: FolderManagerModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const {
    folders,
    sessions,
    currentSessionId,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    createSession,
    moveSessionToFolder,
    switchSession,
    renameSession,
    deleteSession,
  } = useDataStore();
  const { customPrompt, customConfirm } = useDialogs();
  const { showToast } = useToast();
  const [assigningSessionId, setAssigningSessionId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const seenFolderIds = useRef<Set<string>>(new Set());

  const mergeMode = engine.source === 'merged';

  function handleToggleMergeMode() {
    if (mergeMode) {
      // Tắt gộp phiên → quay lại nguồn là phiên đang mở.
      engine.setSource('session');
    } else {
      engine.setSource('merged');
      if (!engine.mergedSessionIds.length && currentSessionId) {
        engine.setMergedSessionIds([currentSessionId]);
      }
    }
  }

  function handleToggleMergeSession(sessionId: string) {
    engine.setMergedSessionIds((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  }

  const { tree, unassigned } = useMemo(() => buildFolderTree(folders, sessions), [folders, sessions]);

  // Mặc định mọi thư mục đều đóng: thư mục nào lần đầu xuất hiện (kể cả
  // thư mục mới tạo) sẽ được thêm vào tập "collapsed" đúng một lần, không
  // ghi đè trạng thái mà người dùng đã tự mở/đóng sau đó.
  useEffect(() => {
    setCollapsed((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const f of folders) {
        if (!seenFolderIds.current.has(f.id)) {
          seenFolderIds.current.add(f.id);
          next.add(f.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [folders]);

  async function handleSelectSession(sessionId: string, name: string) {
    if (mergeMode) {
      handleToggleMergeSession(sessionId);
      return;
    }
    if (sessionId !== currentSessionId) {
      await switchSession(sessionId);
      showToast(`${name}`, 'book-open');
    }
    onClose();
  }

  // siblingIds = id của mọi thư mục cùng cấp (cùng cha) với thư mục vừa bấm,
  // kể cả chính nó. Khi MỞ một thư mục, mọi thư mục cùng cấp khác sẽ tự
  // đóng lại — chỉ tối đa 1 thư mục ở mỗi cấp được mở cùng lúc, để cây thư
  // mục không bị dài lan man khi có nhiều thư mục anh em.
  function toggleExpand(id: string, siblingIds: string[]) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      const isCurrentlyOpen = !prev.has(id);
      if (isCurrentlyOpen) {
        next.add(id);
      } else {
        for (const sid of siblingIds) {
          if (sid === id) next.delete(sid);
          else next.add(sid);
        }
      }
      return next;
    });
  }

  async function handleCreateFolder(parentId: string | null) {
    const name = await customPrompt(parentId ? 'Tên thư mục con mới:' : 'Tên thư mục mới:');
    if (!name) return;
    await createFolder(name, parentId);
    if (parentId) setCollapsed((prev) => { const next = new Set(prev); next.delete(parentId); return next; });
    showToast('Đã tạo thư mục', 'folder-plus');
  }

  // "Phiên mới": tạo 1 phiên trống rồi chuyển sang phiên đó luôn (giống
  // createSession trong DataStore vốn tự activateSession) — nếu tạo từ
  // trong 1 thư mục cụ thể (folderId khác null) thì gán luôn phiên mới
  // vào thư mục đó thay vì để "Không có thư mục".
  async function handleCreateSession(folderId: string | null) {
    const name = await customPrompt('Tên phiên mới:');
    if (!name) return;
    const ns = await createSession(name);
    if (folderId) await moveSessionToFolder(ns.id, folderId);
    showToast('Đã tạo phiên mới', 'plus-circle');
  }

  async function handleRenameFolder(fid: string, current: string) {
    const name = await customPrompt('Đổi tên thư mục:', current);
    if (!name) return;
    await renameFolder(fid, name);
  }

  function collectDescendantFolderIds(fid: string): string[] {
    const direct = folders.filter((f) => f.parentId === fid).map((f) => f.id);
    return direct.reduce<string[]>((acc, id) => [...acc, id, ...collectDescendantFolderIds(id)], []);
  }

  async function handleMoveFolder(fid: string, parentId: string | null) {
    await moveFolder(fid, parentId);
    showToast('Đã chuyển thư mục', 'folder');
  }

  async function handleDeleteFolder(fid: string) {
    if (!(await customConfirm('Xoá thư mục này? Thư mục con và các phiên bên trong sẽ về trạng thái không thư mục.')))
      return;
    const allIds = [fid, ...collectDescendantFolderIds(fid)];
    // Un-assign sessions in this folder (and its subfolders) first — mirrors
    // original behavior: folder deletion doesn't cascade-delete sessions,
    // just orphans them.
    await Promise.all(
      sessions.filter((s) => s.folderId && allIds.includes(s.folderId)).map((s) => moveSessionToFolder(s.id, null))
    );
    // Delete subfolders bottom-up, then the folder itself.
    for (const id of [...allIds].reverse()) {
      // eslint-disable-next-line no-await-in-loop
      await deleteFolder(id);
    }
    showToast('Đã xoá thư mục', 'trash');
  }

  async function handleRenameSession(sid: string, current: string) {
    const name = await customPrompt('Đổi tên phiên:', current);
    if (!name) return;
    await renameSession(sid, name);
    setAssigningSessionId(null);
    showToast('Đã đổi tên phiên', 'edit');
  }

  async function handleDeleteSession(sid: string, name: string) {
    if (!(await customConfirm(`Xoá phiên "${name}"? Toàn bộ từ vựng trong phiên sẽ bị xoá.`))) return;
    await deleteSession(sid);
    setAssigningSessionId(null);
    showToast('Đã xoá phiên', 'trash');
  }

  async function handleExportSessionJson(sid: string, name: string) {
    if (!user) return;
    setAssigningSessionId(null);
    try {
      await exportSessionsToJsonFile(user.uid, [sid], `${name}.json`);
      showToast('Đã xuất JSON', 'check-circle');
    } catch {
      showToast('Lỗi xuất JSON', 'times-circle');
    }
  }

  async function handleExportSessionExcel(sid: string, name: string) {
    if (!user) return;
    setAssigningSessionId(null);
    try {
      const words = await dbGetSessionVocab(user.uid, sid);
      await exportWordsToExcel(words, `${name}.xlsx`);
      showToast('Đã xuất Excel', 'check-circle');
    } catch {
      showToast('Lỗi xuất Excel', 'times-circle');
    }
  }

  // Xuất Excel cả thư mục: gộp mọi phiên nằm trong thư mục này VÀ mọi thư
  // mục con của nó vào 1 file, mỗi phiên là 1 sheet riêng.
  async function handleExportFolderExcel(node: FolderTreeNode) {
    if (!user) return;
    const allSessions = collectSessionsFromNode(node);
    if (!allSessions.length) {
      showToast('Thư mục không có phiên nào để xuất', 'info-circle');
      return;
    }
    try {
      const sessionsData = await Promise.all(
        allSessions.map(async (s) => ({ name: s.name, words: await dbGetSessionVocab(user.uid, s.id) }))
      );
      await exportSessionsToExcel(sessionsData, `${node.folder.name}.xlsx`);
      showToast(`Đã xuất ${allSessions.length} phiên`, 'check-circle');
    } catch {
      showToast('Lỗi xuất Excel', 'times-circle');
    }
  }

  // ---- Chế độ "Gộp phiên": các thao tác Xuất JSON/Xuất Excel/Chuyển thư
  // mục/Xoá phiên mở qua nhấn giữ (long-press) tác động lên TOÀN BỘ các
  // phiên đang được gộp (engine.mergedSessionIds), không phải chỉ riêng
  // phiên vừa nhấn giữ — vì trong chế độ này, khái niệm "phiên đang thao
  // tác" không rõ ràng (đang gộp nhiều phiên lại với nhau).
  async function handleExportMergedJson() {
    if (!user) return;
    const ids = engine.mergedSessionIds;
    if (!ids.length) return;
    try {
      await exportSessionsToJsonFile(user.uid, ids, `Gop_phien_${ids.length}.json`);
      showToast(`Đã xuất ${ids.length} phiên`, 'check-circle');
    } catch {
      showToast('Lỗi xuất JSON', 'times-circle');
    }
  }

  async function handleExportMergedExcel() {
    if (!user) return;
    const ids = engine.mergedSessionIds;
    if (!ids.length) return;
    try {
      const sessionsData = await Promise.all(
        ids.map(async (sid) => ({
          name: sessions.find((s) => s.id === sid)?.name || sid,
          words: await dbGetSessionVocab(user.uid, sid),
        }))
      );
      await exportSessionsToExcel(sessionsData, `Gop_phien_${ids.length}.xlsx`);
      showToast(`Đã xuất ${ids.length} phiên`, 'check-circle');
    } catch {
      showToast('Lỗi xuất Excel', 'times-circle');
    }
  }

  async function handleMoveMergedSessions(folderId: string | null) {
    const ids = engine.mergedSessionIds;
    if (!ids.length) return;
    await Promise.all(ids.map((sid) => moveSessionToFolder(sid, folderId)));
    showToast(`Đã chuyển ${ids.length} phiên`, 'folder');
  }

  async function handleDeleteMergedSessions() {
    const ids = engine.mergedSessionIds;
    if (!ids.length) return;
    if (!(await customConfirm(`Xoá ${ids.length} phiên đang gộp? Toàn bộ từ vựng trong các phiên này sẽ bị xoá.`)))
      return;
    for (const sid of ids) {
      // eslint-disable-next-line no-await-in-loop
      await deleteSession(sid);
    }
    showToast(`Đã xoá ${ids.length} phiên`, 'trash');
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Pressable style={styles.headerTitleGroup} onPress={() => setCreateMenuOpen(true)} hitSlop={4}>
            <Text style={[styles.title, { color: colors.tx }]}>
              <Icon name="folder-open" size={14} color={colors.tx} />{'  '}Quản lý thư mục
            </Text>
            <View style={[styles.titleAddBtn, { borderColor: colors.border }]}>
              <Icon name="plus" size={11} color={colors.tx3} />
            </View>
          </Pressable>
          <Pressable style={styles.mergeChip} onPress={handleToggleMergeMode} hitSlop={4}>
            <Text style={{ color: mergeMode ? '#a371f7' : colors.tx3, fontSize: 12, fontWeight: '600' }}>
              <Icon name="random" size={11} color={mergeMode ? '#a371f7' : colors.tx3} />{'  '}Gộp phiên{mergeMode && engine.mergedSessionIds.length ? ` (${engine.mergedSessionIds.length})` : ''}
            </Text>
            <View style={[styles.switchSmall, { backgroundColor: mergeMode ? '#a371f7' : colors.bg3, borderColor: colors.border }]}>
              <View style={[styles.knobSmall, { alignSelf: mergeMode ? 'flex-end' : 'flex-start' }]} />
            </View>
          </Pressable>
        </View>

        <BottomSheetModal visible={createMenuOpen} onClose={() => setCreateMenuOpen(false)}>
          <MenuItem
            icon="folder"
            label="Thêm thư mục mới"
            onPress={() => {
              setCreateMenuOpen(false);
              handleCreateFolder(null);
            }}
            color={colors.tx}
          />
          <MenuItem
            icon="book"
            label="Thêm phiên mới"
            onPress={() => {
              setCreateMenuOpen(false);
              handleCreateSession(null);
            }}
            color={colors.tx}
          />
        </BottomSheetModal>

        <View style={{ height: 4 }} />

        {tree.map((node) => (
          <FolderNode
            key={node.folder.id}
            node={node}
            depth={0}
            siblingIds={tree.map((n) => n.folder.id)}
            colors={colors}
            collapsed={collapsed}
            onToggleExpand={toggleExpand}
            onCreateSubfolder={handleCreateFolder}
            onCreateSession={handleCreateSession}
            onRename={handleRenameFolder}
            onDelete={handleDeleteFolder}
            onMove={handleMoveFolder}
            allFolders={folders}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            assigningSessionId={assigningSessionId}
            setAssigningSessionId={setAssigningSessionId}
            onAssign={(sid, fid) => {
              moveSessionToFolder(sid, fid);
              setAssigningSessionId(null);
            }}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
            onExportJson={handleExportSessionJson}
            onExportExcel={handleExportSessionExcel}
            onExportFolderExcel={handleExportFolderExcel}
            onExportMergedJson={handleExportMergedJson}
            onExportMergedExcel={handleExportMergedExcel}
            onMoveMerged={handleMoveMergedSessions}
            onDeleteMerged={handleDeleteMergedSessions}
            mergeMode={mergeMode}
            mergedSessionIds={engine.mergedSessionIds}
          />
        ))}

        {!tree.length && (
          <Text style={{ color: colors.tx3, fontSize: 13, marginBottom: 8 }}>
            <Icon name="inbox" size={12} color={colors.tx3} />{'  '}Chưa có thư mục nào
          </Text>
        )}

        <Text style={[styles.folderName, { color: colors.tx2, marginTop: 8 }]}>Không có thư mục</Text>
        {!!unassigned.length && (
          <View style={[styles.sessionGrid, { borderLeftColor: colors.border2 }]}>
            {unassigned.map((s, idx) => (
              <SessionAssignCard
                key={s.id}
                name={s.name}
                isActive={s.id === currentSessionId}
                onSelect={() => handleSelectSession(s.id, s.name)}
                onPress={() => setAssigningSessionId(assigningSessionId === s.id ? null : s.id)}
                isAssigning={assigningSessionId === s.id}
                menuAlign={idx % 2 === 1 ? 'right' : 'left'}
                folders={folders}
                onAssign={mergeMode ? handleMoveMergedSessions : (fid) => { moveSessionToFolder(s.id, fid); setAssigningSessionId(null); }}
                onRename={() => handleRenameSession(s.id, s.name)}
                onDelete={mergeMode ? handleDeleteMergedSessions : () => handleDeleteSession(s.id, s.name)}
                onExportJson={mergeMode ? handleExportMergedJson : () => handleExportSessionJson(s.id, s.name)}
                onExportExcel={mergeMode ? handleExportMergedExcel : () => handleExportSessionExcel(s.id, s.name)}
                mergeMode={mergeMode}
                isMergeChecked={engine.mergedSessionIds.includes(s.id)}
                mergedCount={engine.mergedSessionIds.length}
              />
            ))}
          </View>
        )}
        {!unassigned.length && (
          <Text style={{ color: colors.tx3, fontSize: 12.5, paddingLeft: 10 }}>— (tất cả phiên đã có thư mục)</Text>
        )}

        <View style={{ height: 14 }} />
      </ScrollView>
    </BottomSheetModal>
  );
}

function getDescendantFolderIds(allFolders: Folder[], fid: string): string[] {
  const direct = allFolders.filter((f) => f.parentId === fid).map((f) => f.id);
  return direct.reduce<string[]>((acc, id) => [...acc, id, ...getDescendantFolderIds(allFolders, id)], []);
}

function collectSessionsFromNode(node: FolderTreeNode): Session[] {
  return [...node.sessions, ...node.children.flatMap(collectSessionsFromNode)];
}

function nodeContainsSession(node: FolderTreeNode, sessionId: string | null): boolean {
  if (!sessionId) return false;
  if (node.sessions.some((s) => s.id === sessionId)) return true;
  return node.children.some((child) => nodeContainsSession(child, sessionId));
}

function FolderNode({
  node,
  depth,
  siblingIds,
  colors,
  collapsed,
  onToggleExpand,
  onCreateSubfolder,
  onCreateSession,
  onRename,
  onDelete,
  onMove,
  allFolders,
  currentSessionId,
  onSelectSession,
  assigningSessionId,
  setAssigningSessionId,
  onAssign,
  onRenameSession,
  onDeleteSession,
  onExportJson,
  onExportExcel,
  onExportFolderExcel,
  onExportMergedJson,
  onExportMergedExcel,
  onMoveMerged,
  onDeleteMerged,
  mergeMode,
  mergedSessionIds,
}: {
  node: FolderTreeNode;
  depth: number;
  siblingIds: string[];
  colors: ThemeColors;
  collapsed: Set<string>;
  onToggleExpand: (id: string, siblingIds: string[]) => void;
  onCreateSubfolder: (parentId: string) => void;
  onCreateSession: (folderId: string) => void;
  onRename: (fid: string, current: string) => void;
  onDelete: (fid: string) => void;
  onMove: (fid: string, parentId: string | null) => void;
  allFolders: Folder[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string, name: string) => void;
  assigningSessionId: string | null;
  setAssigningSessionId: (id: string | null) => void;
  onAssign: (sessionId: string, folderId: string | null) => void;
  onRenameSession: (sessionId: string, current: string) => void;
  onDeleteSession: (sessionId: string, name: string) => void;
  onExportJson: (sessionId: string, name: string) => void;
  onExportExcel: (sessionId: string, name: string) => void;
  onExportFolderExcel: (node: FolderTreeNode) => void;
  onExportMergedJson: () => void;
  onExportMergedExcel: () => void;
  onMoveMerged: (folderId: string | null) => void;
  onDeleteMerged: () => void;
  mergeMode: boolean;
  mergedSessionIds: string[];
}) {
  const isOpen = !collapsed.has(node.folder.id);
  const hasOpenMenu = nodeContainsSession(node, assigningSessionId);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);

  // Không cho chuyển vào chính nó hoặc vào một thư mục con cháu của nó
  // (sẽ tạo vòng lặp cha-con).
  const excludedIds = new Set([node.folder.id, ...getDescendantFolderIds(allFolders, node.folder.id)]);
  const moveTargets = allFolders.filter((f) => !excludedIds.has(f.id));

  return (
    <View
      style={[
        styles.folderRow,
        { borderColor: colors.border2, marginLeft: depth * 14 },
        hasOpenMenu && styles.folderRowRaised,
      ]}
    >
      <Pressable style={styles.folderHeader} onPress={() => onToggleExpand(node.folder.id, siblingIds)}>
        <View style={styles.folderHeaderLeft}>
          <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={11} color={colors.tx3} style={styles.chevron} />
          <Text style={[styles.folderName, { color: colors.tx }]} numberOfLines={1}>
            <Icon name="folder" size={12} color={colors.tx} />{'  '}{node.folder.name}
          </Text>
        </View>
        <Pressable onPress={() => setActionsOpen(true)} hitSlop={8} style={styles.sessionMoveBtn}>
          <Icon name="ellipsis-v" size={13} color={colors.tx3} />
        </Pressable>
      </Pressable>

      <BottomSheetModal visible={actionsOpen} onClose={() => setActionsOpen(false)}>
        <Text style={[styles.moveModalTitle, { color: colors.tx }]} numberOfLines={1}>
          <Icon name="folder" size={13} color={colors.tx} />{'  '}{node.folder.name}
        </Text>
        <MenuItem icon="plus" label="Thêm thư mục con" onPress={() => { setActionsOpen(false); onCreateSubfolder(node.folder.id); }} color={colors.tx} />
        <MenuItem icon="book" label="Thêm phiên mới" onPress={() => { setActionsOpen(false); onCreateSession(node.folder.id); }} color={colors.tx} />
        <MenuItem icon="edit" label="Đổi tên" onPress={() => { setActionsOpen(false); onRename(node.folder.id, node.folder.name); }} color={colors.tx} />
        <MenuItem
          icon="file-excel"
          label="Xuất Excel (cả thư mục)"
          onPress={() => { setActionsOpen(false); onExportFolderExcel(node); }}
          color={colors.tx}
        />

        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
        <MenuItem
          icon="folder"
          label="Chuyển đến thư mục"
          trailingIcon="chevron-right"
          onPress={() => {
            setActionsOpen(false);
            setMoveModalOpen(true);
          }}
          color={colors.tx}
        />

        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
        <MenuItem icon="trash" label="Xoá thư mục" onPress={() => { setActionsOpen(false); onDelete(node.folder.id); }} color="#f78166" />
      </BottomSheetModal>

      <BottomSheetModal visible={moveModalOpen} onClose={() => setMoveModalOpen(false)}>
        <Text style={[styles.moveModalTitle, { color: colors.tx }]} numberOfLines={1}>
          Chuyển "{node.folder.name}" đến thư mục
        </Text>
        <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
          <View style={styles.assignOptionsModal}>
            <Pressable
              style={[styles.assignChip, { borderColor: colors.border }]}
              onPress={() => {
                onMove(node.folder.id, null);
                setMoveModalOpen(false);
              }}
            >
              <Text style={{ color: colors.tx3, fontSize: 13 }}>Thư mục gốc</Text>
            </Pressable>
            {moveTargets.map((f) => (
              <Pressable
                key={f.id}
                style={[styles.assignChip, { borderColor: colors.border }]}
                onPress={() => {
                  onMove(node.folder.id, f.id);
                  setMoveModalOpen(false);
                }}
              >
                <Text style={{ color: colors.tx3, fontSize: 13 }}>
                  <Icon name="folder" size={11} color={colors.tx3} />{'  '}{f.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </BottomSheetModal>

      {isOpen && (
        <View style={{ marginTop: 6 }}>
          {node.children.map((child) => (
            <FolderNode
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              siblingIds={node.children.map((c) => c.folder.id)}
              colors={colors}
              collapsed={collapsed}
              onToggleExpand={onToggleExpand}
              onCreateSubfolder={onCreateSubfolder}
              onCreateSession={onCreateSession}
              onRename={onRename}
              onDelete={onDelete}
              onMove={onMove}
              allFolders={allFolders}
              currentSessionId={currentSessionId}
              onSelectSession={onSelectSession}
              assigningSessionId={assigningSessionId}
              setAssigningSessionId={setAssigningSessionId}
              onAssign={onAssign}
              onRenameSession={onRenameSession}
              onDeleteSession={onDeleteSession}
              onExportJson={onExportJson}
              onExportExcel={onExportExcel}
              onExportFolderExcel={onExportFolderExcel}
              onExportMergedJson={onExportMergedJson}
              onExportMergedExcel={onExportMergedExcel}
              onMoveMerged={onMoveMerged}
              onDeleteMerged={onDeleteMerged}
              mergeMode={mergeMode}
              mergedSessionIds={mergedSessionIds}
            />
          ))}
          {!!node.sessions.length && (
            <View style={[styles.sessionGrid, { borderLeftColor: colors.border2 }]}>
              {node.sessions.map((s, idx) => (
                <SessionAssignCard
                  key={s.id}
                  name={s.name}
                  isActive={s.id === currentSessionId}
                  onSelect={() => onSelectSession(s.id, s.name)}
                  onPress={() => setAssigningSessionId(assigningSessionId === s.id ? null : s.id)}
                  isAssigning={assigningSessionId === s.id}
                  menuAlign={idx % 2 === 1 ? 'right' : 'left'}
                  folders={allFolders}
                  onAssign={mergeMode ? onMoveMerged : (fid) => onAssign(s.id, fid)}
                  onRename={() => onRenameSession(s.id, s.name)}
                  onDelete={mergeMode ? onDeleteMerged : () => onDeleteSession(s.id, s.name)}
                  onExportJson={mergeMode ? onExportMergedJson : () => onExportJson(s.id, s.name)}
                  onExportExcel={mergeMode ? onExportMergedExcel : () => onExportExcel(s.id, s.name)}
                  mergeMode={mergeMode}
                  isMergeChecked={mergedSessionIds.includes(s.id)}
                  mergedCount={mergedSessionIds.length}
                />
              ))}
            </View>
          )}
          {!node.children.length && !node.sessions.length && (
            <Text style={{ color: colors.tx3, fontSize: 12, paddingLeft: 10, paddingVertical: 4 }}>Trống</Text>
          )}
        </View>
      )}
    </View>
  );
}

function SessionAssignCard({
  name,
  isActive,
  onSelect,
  onPress,
  isAssigning,
  menuAlign = 'left',
  folders,
  onAssign,
  onRename,
  onDelete,
  onExportJson,
  onExportExcel,
  mergeMode = false,
  isMergeChecked = false,
  mergedCount = 0,
}: {
  name: string;
  isActive: boolean;
  onSelect: () => void;
  onPress: () => void;
  isAssigning: boolean;
  menuAlign?: 'left' | 'right';
  folders: Folder[];
  onAssign: (fid: string | null) => void;
  onRename: () => void;
  onDelete: () => void;
  onExportJson: () => void;
  onExportExcel: () => void;
  mergeMode?: boolean;
  isMergeChecked?: boolean;
  mergedCount?: number;
}) {
  const { colors } = useTheme();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);

  // Chế độ gộp phiên: phiên đang mở luôn nổi bật màu riêng (vàng) để phân
  // biệt với các phiên khác được chọn để gộp (tím), kể cả khi đã tick chọn.
  const borderColor = mergeMode
    ? isActive
      ? '#d29922'
      : isMergeChecked
        ? '#a371f7'
        : colors.border2
    : isActive
      ? '#58a6ff'
      : colors.border2;
  const bgColor = mergeMode
    ? isActive
      ? 'rgba(210,153,34,0.14)'
      : isMergeChecked
        ? 'rgba(163,113,247,0.14)'
        : undefined
    : isActive
      ? 'rgba(88,166,255,0.12)'
      : undefined;
  const textColor = mergeMode ? (isActive ? '#d29922' : isMergeChecked ? '#a371f7' : colors.tx) : isActive ? '#58a6ff' : colors.tx;

  return (
    <View style={styles.sessionCardWrap}>
      <Pressable
        style={[styles.sessionCard, { borderColor }, !!bgColor && { backgroundColor: bgColor }]}
        onPress={onSelect}
        // Ở chế độ "Gộp phiên", nút "..." (mở menu Đổi tên/Xuất JSON/Xuất
        // Excel/Chuyển thư mục/Xoá phiên) bị ẩn đi vì onPress của cả thẻ đã
        // dùng để tick/bỏ tick gộp — nhấn GIỮ vào thẻ phiên để mở menu đó
        // thay thế. Giữ luôn cho cả chế độ thường, không gây xung đột vì
        // "..." vẫn còn hiển thị song song.
        onLongPress={() => setActionsOpen(true)}
      >
        {mergeMode && (
          <View style={[styles.checkbox, { borderColor: isMergeChecked ? textColor : colors.border, backgroundColor: isMergeChecked ? textColor : 'transparent' }]}>
            {isMergeChecked && <Icon name="check" size={9} color="#0d1117" />}
          </View>
        )}
        <Text
          style={{ color: textColor, fontSize: 13, fontWeight: isActive || isMergeChecked ? '700' : '600', flex: 1 }}
          numberOfLines={1}
        >
          {!mergeMode && isActive ? <Icon name="play" size={9} color={textColor} /> : null}{!mergeMode && isActive ? ' ' : ''}
          {name}
          {mergeMode && isActive ? ' (hiện tại)' : ''}
        </Text>
        {!mergeMode && (
          <Pressable onPress={() => setActionsOpen(true)} hitSlop={8} style={styles.sessionMoveBtn}>
            <Icon name="ellipsis-v" size={13} color={colors.tx3} />
          </Pressable>
        )}
      </Pressable>

      <BottomSheetModal visible={actionsOpen} onClose={() => setActionsOpen(false)}>
        <Text style={[styles.moveModalTitle, { color: colors.tx }]} numberOfLines={1}>
          {mergeMode ? `${mergedCount} phiên đang gộp` : name}
        </Text>
        {!mergeMode && (
          <MenuItem icon="edit" label="Đổi tên" onPress={() => { setActionsOpen(false); onRename(); }} color={colors.tx} />
        )}
        <MenuItem
          icon="file-code"
          label={mergeMode ? `Xuất ${mergedCount} JSON` : 'Xuất JSON'}
          onPress={() => { setActionsOpen(false); onExportJson(); }}
          color={colors.tx}
        />
        <MenuItem
          icon="file-excel"
          label={mergeMode ? `Xuất ${mergedCount} Excel` : 'Xuất Excel'}
          onPress={() => { setActionsOpen(false); onExportExcel(); }}
          color={colors.tx}
        />

        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
        <MenuItem
          icon="folder"
          label={mergeMode ? `Chuyển ${mergedCount} phiên` : 'Chuyển thư mục'}
          trailingIcon="chevron-right"
          onPress={() => {
            setActionsOpen(false);
            setMoveModalOpen(true);
          }}
          color={colors.tx}
        />

        <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
        <MenuItem
          icon="trash"
          label={mergeMode ? `Xoá ${mergedCount} phiên` : 'Xoá phiên'}
          onPress={() => { setActionsOpen(false); onDelete(); }}
          color="#f78166"
        />
      </BottomSheetModal>

      <BottomSheetModal visible={moveModalOpen} onClose={() => setMoveModalOpen(false)}>
        <Text style={[styles.moveModalTitle, { color: colors.tx }]} numberOfLines={1}>
          {mergeMode ? `Chuyển ${mergedCount} phiên đến thư mục` : `Chuyển "${name}" đến thư mục`}
        </Text>
        <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
          <View style={styles.assignOptionsModal}>
            <Pressable
              style={[styles.assignChip, { borderColor: colors.border }]}
              onPress={() => {
                onAssign(null);
                setMoveModalOpen(false);
              }}
            >
              <Text style={{ color: colors.tx3, fontSize: 13 }}>Không thư mục</Text>
            </Pressable>
            {folders.map((f) => (
              <Pressable
                key={f.id}
                style={[styles.assignChip, { borderColor: colors.border }]}
                onPress={() => {
                  onAssign(f.id);
                  setMoveModalOpen(false);
                }}
              >
                <Text style={{ color: colors.tx3, fontSize: 13 }}>
                <Icon name="folder" size={11} color={colors.tx3} />{'  '}{f.name}
              </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  color,
  trailingIcon,
}: {
  icon: IconProps['name'];
  label: string;
  onPress: () => void;
  color: string;
  trailingIcon?: IconProps['name'];
}) {
  return (
    <Pressable style={[styles.menuItem, !!trailingIcon && styles.menuItemSpread]} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <Icon name={icon} size={13} color={color} />
        <Text style={{ color, fontSize: 12.8, fontWeight: '600' }}>{label}</Text>
      </View>
      {!!trailingIcon && <Icon name={trailingIcon} size={11} color={color} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 },
  headerTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  titleAddBtn: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  folderRow: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  folderRowRaised: { zIndex: 100, elevation: 100 },
  folderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  folderHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  chevron: { fontSize: 12, width: 12 },
  folderName: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 14, borderLeftWidth: 1.5, marginTop: 6 },
  sessionCardWrap: { width: '31%', position: 'relative' },
  sessionCardWrapRaised: { zIndex: 50, elevation: 50 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  sessionMoveBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  actionsMenu: {
    position: 'absolute',
    width: 230,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 12 },
  menuItemSpread: { justifyContent: 'space-between' },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuDivider: { height: 1, marginVertical: 4 },
  assignOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 6 },
  moveModalTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  assignOptionsModal: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  assignChip: { borderWidth: 1, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  mergeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  switchSmall: { width: 30, height: 17, borderRadius: 9, borderWidth: 1, padding: 1.5, justifyContent: 'center' },
  knobSmall: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  checkbox: { width: 16, height: 16, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
});
