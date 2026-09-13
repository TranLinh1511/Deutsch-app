import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { useDataStore } from '@/store/DataStore';
import { useDialogs } from '@/store/DialogsContext';
import { useToast } from '@/store/ToastContext';
import WordItemCard from './WordItemCard';
import WordFormModal from './WordFormModal';
import ImportExportModal from './ImportExportModal';
import Icon from './Icon';
import type { VocabWord } from '@/types/models';

type FilterTab = 'all' | 'active' | 'mastered' | 'flagged';
type WordTypeFilter = 'all' | 'n' | 'v' | 'other';

const PAGE_SIZE = 20;

const WORD_TYPE_OPTIONS: [WordTypeFilter, string][] = [
  ['all', 'Tất cả loại từ'],
  ['n', 'Danh từ'],
  ['v', 'Động từ'],
  ['other', 'Khác'],
];

const STATUS_OPTIONS: [FilterTab, string][] = [
  ['all', 'Tất cả'],
  ['active', 'Đang học'],
  ['mastered', 'Đã thuộc'],
  ['flagged', 'Chú ý'],
];

/** Gộp wordType tự do (n, v, adj, Nomen, Verb...) về 1 trong 3 nhóm hiển thị. */
function classifyWordType(wordType: string | undefined): Exclude<WordTypeFilter, 'all'> {
  const t = (wordType || '').trim().toLowerCase();
  if (!t) return 'other';
  if (t.startsWith('n') || t.includes('danh')) return 'n';
  if (t.startsWith('v') || t.includes('động')) return 'v';
  return 'other';
}

/** Danh sách nút số trang hiển thị, rút gọn bằng "…" khi có nhiều trang. */
function buildPageList(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

/**
 * Rebuild of renderSidebar()/_renderSidebarInner() (index.html) as the
 * @react-navigation/drawer custom drawerContent. Covers checklist B
 * (session switch/create/delete), C (folder access), D (word CRUD via
 * WordFormModal + WordItemCard's edit/delete).
 *
 * "Gộp nhiều phiên để luyện chung" (merge sessions): the merge state
 * (source/mergedSessionIds) now lives in DataStore (shared with the
 * practice engine), so while merge mode is active this list shows the
 * FULL combined vocabulary of every merged session (DataStore.mergedVocab),
 * not just the currently active session — each item is tagged with which
 * session it came from.
 */
export default function SidebarDrawer() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    vocab,
    masteredIds,
    flaggedIds,
    addWord,
    source,
    mergedVocab,
    mergedMasteredIds,
    mergedFlaggedIds,
    toggleMasteredForSession,
    toggleFlaggedForSession,
    updateWordForSession,
    deleteWordForSession,
    currentSessionId,
    sessions,
  } = useDataStore();
  const { customConfirm } = useDialogs();
  const { showToast } = useToast();

  const isMerged = source === 'merged';
  // Nguồn từ vựng hiển thị: gộp (mọi phiên đã gộp) hoặc chỉ phiên hiện tại.
  const sourceVocab: (VocabWord & { _sessId?: string })[] = isMerged ? mergedVocab : vocab;
  const sourceMasteredIds = isMerged ? mergedMasteredIds : masteredIds;
  const sourceFlaggedIds = isMerged ? mergedFlaggedIds : flaggedIds;

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [wordTypeFilter, setWordTypeFilter] = useState<WordTypeFilter>('all');
  const [openDropdown, setOpenDropdown] = useState<'type' | 'status' | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [wordFormVisible, setWordFormVisible] = useState(false);
  const [editingWord, setEditingWord] = useState<VocabWord | null>(null);
  const [importExportVisible, setImportExportVisible] = useState(false);
  const [page, setPage] = useState(1);

  const filteredVocab = useMemo(() => {
    let list = sourceVocab;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (w) => w.originalGerman.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
      );
    }
    if (filterTab === 'active') list = list.filter((w) => !sourceMasteredIds.has(w.id));
    else if (filterTab === 'mastered') list = list.filter((w) => sourceMasteredIds.has(w.id));
    else if (filterTab === 'flagged') list = list.filter((w) => sourceFlaggedIds.has(w.id));
    if (wordTypeFilter !== 'all') list = list.filter((w) => classifyWordType(w.wordType) === wordTypeFilter);
    return list;
  }, [sourceVocab, search, filterTab, wordTypeFilter, sourceMasteredIds, sourceFlaggedIds]);

  const totalPages = Math.max(1, Math.ceil(filteredVocab.length / PAGE_SIZE));

  const pagedVocab = useMemo(
    () => filteredVocab.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredVocab, page]
  );

  // Về trang 1 mỗi khi bộ lọc/tìm kiếm thay đổi (danh sách kết quả khác đi).
  useEffect(() => {
    setPage(1);
  }, [search, filterTab, wordTypeFilter]);

  // Nếu trang hiện tại vượt quá tổng số trang (vd sau khi xoá từ), kẹp lại.
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  function toggleBulkSelect(id: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function sessionIdOf(wordId: string): string | null {
    if (!isMerged) return currentSessionId;
    return sourceVocab.find((w) => w.id === wordId)?._sessId ?? currentSessionId;
  }

  async function handleBulkDelete() {
    if (!bulkSelected.size) return;
    if (!(await customConfirm(`Xoá ${bulkSelected.size} từ đã chọn?`))) return;
    await Promise.all(
      [...bulkSelected].map((id) => {
        const sid = sessionIdOf(id);
        return sid ? deleteWordForSession(sid, id) : Promise.resolve();
      })
    );
    setBulkSelected(new Set());
    setBulkMode(false);
    showToast('Đã xoá các từ đã chọn', 'trash');
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg2, paddingTop: insets.top }]}>
      {/* Search + filter tabs */}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Tìm từ vựng..."
        placeholderTextColor={colors.tx3}
        style={[styles.searchInput, { color: colors.tx, backgroundColor: colors.bg3, borderColor: colors.border }]}
      />
      {!!openDropdown && (
        <Pressable style={styles.dropdownScrim} onPress={() => setOpenDropdown(null)} />
      )}
      <View style={styles.filterRow}>
        <FilterDropdown
          isOpen={openDropdown === 'type'}
          onOpenChange={(o) => setOpenDropdown(o ? 'type' : null)}
          value={wordTypeFilter}
          options={WORD_TYPE_OPTIONS}
          onChange={setWordTypeFilter}
        />
        <FilterDropdown
          isOpen={openDropdown === 'status'}
          onOpenChange={(o) => setOpenDropdown(o ? 'status' : null)}
          value={filterTab}
          options={STATUS_OPTIONS}
          onChange={setFilterTab}
        />
      </View>

      {/* Bulk mode toolbar */}
      <View style={styles.bulkRow}>
        <Pressable
          onPress={() => {
            setBulkMode((v) => !v);
            setBulkSelected(new Set());
          }}
        >
          <Text style={{ color: bulkMode ? '#58a6ff' : colors.tx3, fontSize: 12 }}>
            <Icon name={bulkMode ? 'times' : 'check-square'} size={11} color={bulkMode ? '#58a6ff' : colors.tx3} />{'  '}
            {bulkMode ? 'Thoát chọn' : 'Chọn nhiều'}
          </Text>
        </Pressable>
        {bulkMode && bulkSelected.size > 0 && (
          <Pressable onPress={handleBulkDelete}>
            <Text style={{ color: '#f78166', fontSize: 12 }}>
            <Icon name="trash" size={11} color="#f78166" />{'  '}Xoá ({bulkSelected.size})
          </Text>
          </Pressable>
        )}
      </View>

      {/* Word list */}
      <FlatList
        data={pagedVocab}
        keyExtractor={(w) => w.id}
        contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}
        ListEmptyComponent={
          <Text style={{ color: colors.tx3, textAlign: 'center', marginTop: 24 }}>
            <Icon name="inbox" size={12} color={colors.tx3} />{'  '}Không có từ nào
          </Text>
        }
        renderItem={({ item }) => {
          const sid = item._sessId ?? currentSessionId;
          return (
            <WordItemCard
              word={item}
              isMastered={sourceMasteredIds.has(item.id)}
              isFlagged={sourceFlaggedIds.has(item.id)}
              isBulkMode={bulkMode}
              isSelected={bulkSelected.has(item.id)}
              onToggleSelect={() => toggleBulkSelect(item.id)}
              sessionLabel={isMerged ? sessions.find((s) => s.id === item._sessId)?.name : undefined}
              onEdit={() => {
                setEditingWord(item);
                setWordFormVisible(true);
              }}
              onToggleMastered={() => sid && toggleMasteredForSession(sid, item.id)}
              onToggleFlagged={() => sid && toggleFlaggedForSession(sid, item.id)}
              onDelete={async () => {
                if (sid && (await customConfirm(`Xoá từ "${item.originalGerman}"?`))) await deleteWordForSession(sid, item.id);
              }}
            />
          );
        }}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.pagination}>
              <Pressable
                disabled={page <= 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                style={[styles.pageBtn, { borderColor: colors.border, opacity: page <= 1 ? 0.4 : 1 }]}
              >
                <Text style={{ color: colors.tx2, fontSize: 12 }}>‹</Text>
              </Pressable>
              {buildPageList(page, totalPages).map((p, i) =>
                p === '...' ? (
                  <Text key={`dots-${i}`} style={{ color: colors.tx3, fontSize: 12, paddingHorizontal: 2 }}>
                    …
                  </Text>
                ) : (
                  <Pressable
                    key={p}
                    onPress={() => setPage(p)}
                    style={[
                      styles.pageBtn,
                      { backgroundColor: p === page ? '#58a6ff' : colors.bg3, borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={{
                        color: p === page ? '#fff' : colors.tx2,
                        fontSize: 12,
                        fontWeight: p === page ? '700' : '400',
                      }}
                    >
                      {p}
                    </Text>
                  </Pressable>
                )
              )}
              <Pressable
                disabled={page >= totalPages}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={[styles.pageBtn, { borderColor: colors.border, opacity: page >= totalPages ? 0.4 : 1 }]}
              >
                <Text style={{ color: colors.tx2, fontSize: 12 }}>›</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      {/* Floating add-word button */}
      <Pressable
        style={[styles.fab, { backgroundColor: '#58a6ff', bottom: 16 + insets.bottom }]}
        onPress={() => {
          setEditingWord(null);
          setWordFormVisible(true);
        }}
      >
        <Text style={styles.fabText}>+ Thêm từ</Text>
      </Pressable>

      <WordFormModal
        visible={wordFormVisible}
        onClose={() => setWordFormVisible(false)}
        initialWord={editingWord}
        onSubmit={async (w) => {
          if (editingWord) {
            const sid = (editingWord as VocabWord & { _sessId?: string })._sessId ?? currentSessionId;
            if (sid) await updateWordForSession(sid, { ...editingWord, ...w });
          } else {
            await addWord({ id: 'w_' + Date.now(), ...w }, vocab.length);
          }
        }}
        onSubmitBulk={async (words) => {
          let order = vocab.length;
          for (let i = 0; i < words.length; i++) {
            // eslint-disable-next-line no-await-in-loop
            await addWord({ id: `w_${Date.now()}_${i}`, ...words[i] }, order++);
          }
          showToast(`Đã thêm ${words.length} từ`, 'check-circle');
        }}
        onDelete={
          editingWord
            ? async () => {
                const sid = (editingWord as VocabWord & { _sessId?: string })._sessId ?? currentSessionId;
                if (sid) {
                  await deleteWordForSession(sid, editingWord.id);
                  showToast('Đã xoá từ', 'trash');
                }
              }
            : undefined
        }
      />
      <ImportExportModal visible={importExportVisible} onClose={() => setImportExportVisible(false)} />
    </View>
  );
}

function FilterDropdown<T extends string>({
  isOpen,
  onOpenChange,
  value,
  options,
  onChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  const selectedLabel = options.find(([key]) => key === value)?.[1] ?? '';
  return (
    <View style={styles.dropdownWrap}>
      <Pressable
        style={[
          styles.dropdownBtn,
          { backgroundColor: colors.bg3, borderColor: isOpen ? '#58a6ff' : colors.border },
        ]}
        onPress={() => onOpenChange(!isOpen)}
      >
        <Text style={{ color: colors.tx2, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Text style={{ color: colors.tx3, fontSize: 9 }}>{isOpen ? '▲' : '▼'}</Text>
      </Pressable>
      {isOpen && (
        <View style={[styles.dropdownMenu, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
          {options.map(([key, label]) => {
            const active = key === value;
            return (
              <Pressable
                key={key}
                style={[styles.dropdownItem, active && { backgroundColor: '#58a6ff' }]}
                onPress={() => {
                  onChange(key);
                  onOpenChange(false);
                }}
              >
                <Text style={{ color: active ? '#fff' : colors.tx2, fontSize: 12.5, fontWeight: active ? '700' : '400' }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 12 },
  searchInput: { borderWidth: 1.5, borderRadius: 9, padding: 10, fontSize: 13.5, marginBottom: 8 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8, zIndex: 30 },
  dropdownWrap: { flex: 1 },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 40,
    elevation: 8,
  },
  dropdownItem: { paddingVertical: 9, paddingHorizontal: 12 },
  dropdownScrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20 },
  bulkRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  pageBtn: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
});
