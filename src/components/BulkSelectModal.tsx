import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, Modal } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { useDataStore } from '@/store/DataStore';
import { normSearch } from '@/utils/grading';
import BottomSheetModal from './BottomSheetModal';
import Icon from './Icon';
import type { PracticeEngine } from '@/hooks/usePracticeEngine';
import type { Question } from '@/utils/questionBuilder';

/**
 * "Chọn từ luyện tập" — mở từ icon ☑️ trên Header. Cho phép người dùng
 * tick/bỏ tick từng từ trong phiên hiện tại (có tìm kiếm + lọc theo trạng
 * thái thuộc/loại từ) rồi bấm Áp dụng để thu hẹp tập câu hỏi luyện tập
 * (engine.selectedWordIds). Bấm Huỷ đóng modal mà không đổi gì.
 *
 * Dùng engine.selectionPool thay vì DataStore.vocab trực tiếp, vì khi đang
 * ở chế độ "Gộp phiên" (engine.source === 'merged') selectionPool chứa đủ
 * từ vựng của TẤT CẢ các phiên đã gộp, không chỉ phiên đang active.
 */
interface BulkSelectModalProps {
  visible: boolean;
  onClose: () => void;
  engine: PracticeEngine;
}

type StatusFilter = 'all' | 'unmastered' | 'mastered' | 'flagged';
type WordTypeFilter = 'all' | 'n' | 'v' | 'other';

const STATUS_OPTIONS: [StatusFilter, string][] = [
  ['all', 'Tất cả'],
  ['unmastered', 'Chưa thuộc'],
  ['mastered', 'Đã thuộc'],
  ['flagged', 'Đã đánh dấu'],
];

const WORD_TYPE_OPTIONS: [WordTypeFilter, string][] = [
  ['all', 'Tất cả loại từ'],
  ['n', 'Danh từ'],
  ['v', 'Động từ'],
  ['other', 'Khác'],
];

/** Gộp wordType tự do (n, n (Pl.), v, adj, adv, other...) về 1 trong 3 nhóm hiển thị. */
function classifyWordType(wordType: string | undefined): Exclude<WordTypeFilter, 'all'> {
  const t = (wordType || '').trim().toLowerCase();
  if (!t) return 'other';
  if (t.startsWith('n') || t.includes('danh')) return 'n';
  if (t.startsWith('v') || t.includes('động')) return 'v';
  return 'other';
}

/** selectedWordIds dùng _realId (id gốc của từ) khi ở chế độ merged, id câu hỏi khi không. */
function realId(q: Question): string {
  return q._realId ?? q.id;
}

export default function BulkSelectModal({ visible, onClose, engine }: BulkSelectModalProps) {
  const { colors } = useTheme();
  const { sessions } = useDataStore();
  const pool = engine.selectionPool;
  const isMerged = engine.source === 'merged';

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<WordTypeFilter>('all');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [openPicker, setOpenPicker] = useState<'status' | 'type' | null>(null);
  // true kể từ khi người dùng tự tay tick/bỏ tick ít nhất 1 từ (toggleWord
  // hoặc toggleAllFiltered) TRONG LẦN MỞ MODAL NÀY — xem applyFilterChange
  // bên dưới. Luôn reset về false mỗi lần mở lại modal (kể cả khi lần
  // trước đã Áp dụng 1 lựa chọn tuỳ biến) — nếu không, mở lại modal rồi đổi
  // "Loại từ" sang vd. Động từ sẽ không tự động tick hết Động từ nữa (phải
  // tự "Bỏ chọn tất cả" rồi tick lại thủ công), đúng bug đã gặp trước đây.
  const [dirty, setDirty] = useState(false);

  function computeFiltered(q: string, sf: StatusFilter, tf: WordTypeFilter) {
    const needle = normSearch(q.trim());
    return pool.filter((w) => {
      if (needle && !normSearch(w.fullDisplayGerman).includes(needle) && !normSearch(w.meaning).includes(needle)) {
        return false;
      }
      if (sf === 'unmastered' && w.isMastered) return false;
      if (sf === 'mastered' && !w.isMastered) return false;
      if (sf === 'flagged' && !w.isFlagged) return false;
      if (tf !== 'all' && classifyWordType(w.wordType) !== tf) return false;
      return true;
    });
  }

  // Mỗi lần mở modal: nạp lại lựa chọn hiện tại của engine (nếu đã Áp dụng
  // trước đó thì giữ nguyên, chưa từng lọc thì mặc định tick hết) và đưa mọi
  // bộ lọc + dirty về trạng thái mặc định. Gọi setState trực tiếp (không
  // qua applyFilterChange) để không tự động đồng bộ lại checked ngay khi
  // vừa mở — checked vừa nạp ở trên phải được giữ nguyên cho tới khi người
  // dùng thực sự đổi bộ lọc.
  useEffect(() => {
    if (!visible) return;
    setChecked(engine.selectedWordIds ?? new Set(pool.map(realId)));
    setQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const filtered = useMemo(
    () => computeFiltered(query, statusFilter, typeFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, query, statusFilter, typeFilter]
  );

  // Áp dụng 1 thay đổi bộ lọc (tìm kiếm / trạng thái / loại từ) do người
  // dùng chủ động thao tác. Nếu từ đầu lần mở modal này CHƯA có thao tác
  // tick/bỏ tick thủ công nào (dirty=false), tự động đồng bộ lại `checked`
  // = đúng danh sách vừa lọc theo bộ lọc MỚI — đổi "Loại từ" sang Động từ là
  // có tác dụng ngay (tick hết Động từ), không cần bỏ chọn tất cả rồi tick
  // lại thủ công. Sau khi người dùng tự tay tick/bỏ tick 1 từ bất kỳ
  // (dirty=true), auto-sync này tắt hẳn để không ghi đè lựa chọn thủ công
  // khi đổi bộ lọc tiếp — vẫn giữ được cách kết hợp cũ (lọc Danh từ bỏ vài
  // từ, rồi lọc Động từ bỏ thêm vài từ khác, cộng dồn thành 1 tập chọn tuỳ ý).
  function applyFilterChange(nextQuery: string, nextStatus: StatusFilter, nextType: WordTypeFilter) {
    setQuery(nextQuery);
    setStatusFilter(nextStatus);
    setTypeFilter(nextType);
    if (!dirty) {
      setChecked(new Set(computeFiltered(nextQuery, nextStatus, nextType).map(realId)));
    }
  }

  function toggleWord(id: string) {
    setDirty(true);
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setDirty(true);
    const allChecked = filtered.length > 0 && filtered.every((w) => checked.has(realId(w)));
    setChecked((prev) => {
      const next = new Set(prev);
      filtered.forEach((w) => (allChecked ? next.delete(realId(w)) : next.add(realId(w))));
      return next;
    });
  }

  function handleApply() {
    // Nếu đã tick toàn bộ từ trong tập nguồn (phiên hiện tại, hoặc mọi phiên
    // đã gộp) thì coi như KHÔNG lọc gì (null), để không ảnh hưởng tới các
    // cờ khác (onlyUnmastered...).
    engine.setSelectedWordIds(checked.size === pool.length ? null : new Set(checked));
    onClose();
  }

  const allFilteredChecked = filtered.length > 0 && filtered.every((w) => checked.has(realId(w)));

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.tx, flexDirection: 'row', alignItems: 'center' }]}>
          <Icon name="check-square" size={14} color={colors.tx} />{'  '}Chọn từ luyện tập
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Icon name="times" size={16} color={colors.tx3} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={(text) => applyFilterChange(text, statusFilter, typeFilter)}
          placeholder="Tìm từ..."
          placeholderTextColor={colors.tx3}
          style={[styles.input, { color: colors.tx, backgroundColor: colors.bg3, borderColor: colors.border }]}
        />
      </View>

      <View style={styles.filterRow}>
        <DropdownPill
          label={STATUS_OPTIONS.find(([v]) => v === statusFilter)?.[1] || ''}
          onPress={() => setOpenPicker('status')}
        />
        <DropdownPill
          label={WORD_TYPE_OPTIONS.find(([v]) => v === typeFilter)?.[1] || ''}
          onPress={() => setOpenPicker('type')}
        />
      </View>

      <Pressable onPress={toggleAllFiltered} style={styles.selectAllRow} hitSlop={4}>
        <Checkbox checked={allFilteredChecked} />
        <Text style={{ color: colors.tx2, fontSize: 12.5, fontWeight: '600' }}>
          {allFilteredChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'} ({filtered.length})
        </Text>
      </Pressable>

      <FlatList
        data={filtered}
        keyExtractor={(w) => realId(w) + ':' + w.id}
        style={{ maxHeight: 360 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={{ color: colors.tx3, textAlign: 'center', padding: 20 }}>Không tìm thấy từ nào</Text>
        }
        renderItem={({ item }) => (
          <WordRow
            word={item}
            isChecked={checked.has(realId(item))}
            onToggle={() => toggleWord(realId(item))}
            sessionLabel={isMerged ? sessions.find((s) => s.id === item._sessId)?.name : undefined}
          />
        )}
      />

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={{ color: colors.tx3, fontSize: 12.5 }}>
          {checked.size}/{pool.length}
        </Text>
        <View style={styles.footerBtns}>
          <Pressable style={[styles.btn, styles.btnGhost, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={{ color: colors.tx2, fontSize: 14, fontWeight: '600' }}>Huỷ</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleApply}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
              <Icon name="check-circle" size={13} color="#fff" />{'  '}Áp dụng
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={openPicker !== null} transparent animationType="fade" onRequestClose={() => setOpenPicker(null)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setOpenPicker(null)}>
          <View style={[styles.pickerBox, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
            {openPicker === 'status'
              ? STATUS_OPTIONS.map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={[styles.pickerRow, value === statusFilter && { backgroundColor: 'rgba(88,166,255,0.12)' }]}
                    onPress={() => {
                      applyFilterChange(query, value, typeFilter);
                      setOpenPicker(null);
                    }}
                  >
                    <Text style={{ color: value === statusFilter ? '#58a6ff' : colors.tx, fontSize: 14, fontWeight: value === statusFilter ? '700' : '400' }}>
                      {label}
                    </Text>
                  </Pressable>
                ))
              : WORD_TYPE_OPTIONS.map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={[styles.pickerRow, value === typeFilter && { backgroundColor: 'rgba(88,166,255,0.12)' }]}
                    onPress={() => {
                      applyFilterChange(query, statusFilter, value);
                      setOpenPicker(null);
                    }}
                  >
                    <Text style={{ color: value === typeFilter ? '#58a6ff' : colors.tx, fontSize: 14, fontWeight: value === typeFilter ? '700' : '400' }}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
          </View>
        </Pressable>
      </Modal>
    </BottomSheetModal>
  );
}

function WordRow({
  word,
  isChecked,
  onToggle,
  sessionLabel,
}: {
  word: Question;
  isChecked: boolean;
  onToggle: () => void;
  sessionLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable style={styles.wordRow} onPress={onToggle}>
      <Checkbox checked={isChecked} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.wordHeadRow}>
          <Text style={{ color: colors.tx, fontSize: 14, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
            {word.fullDisplayGerman}
          </Text>
          {!!word.wordType && (
            <View style={styles.wtBadge}>
              <Text style={styles.wtBadgeText}>{word.wordType}</Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.tx3, fontSize: 12.5 }} numberOfLines={1}>
          {word.meaning}
          {sessionLabel ? ` · ${sessionLabel}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.checkbox,
        {
          borderColor: checked ? '#58a6ff' : colors.border,
          backgroundColor: checked ? '#58a6ff' : 'transparent',
        },
      ]}
    >
      {checked && <Icon name="check" size={9} color="#fff" />}
    </View>
  );
}

function DropdownPill({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.dropdownPill, { borderColor: colors.border, backgroundColor: colors.bg3 }]}>
      <Text style={{ color: colors.tx2, fontSize: 12.5 }}>{label} </Text>
      <Icon name="chevron-down" size={9} color={colors.tx2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  searchRow: { marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: 9, padding: 11, fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dropdownPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 2 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 2 },
  wordHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  wtBadge: {
    backgroundColor: 'rgba(210,168,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(210,168,255,0.25)',
    borderRadius: 4,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  wtBadgeText: { color: '#d2a8ff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 8,
  },
  footerBtns: { flexDirection: 'row', gap: 8 },
  btn: { borderRadius: 9, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { borderWidth: 1.5 },
  btnPrimary: { backgroundColor: '#58a6ff' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  pickerBox: { borderWidth: 1, borderRadius: 12, paddingVertical: 6, minWidth: 200, maxHeight: 320 },
  pickerRow: { paddingVertical: 11, paddingHorizontal: 18 },
});
