import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useDataStore } from '@/store/DataStore';
import { useToast } from '@/store/ToastContext';
import BottomSheetModal from './BottomSheetModal';
import AuthButton from './auth/AuthButton';
import { buildQuestionList, buildMergedQuestionList, type Question } from '@/utils/questionBuilder';
import { dbGetSessionVocab } from '@/services/firebase/words';
import { dbGetMastered, dbGetFlagged } from '@/services/firebase/masteredFlagged';
import type { PracticeEngine } from '@/hooks/usePracticeEngine';

type MasteredFilter = 'all' | 'active' | 'mastered' | 'flagged';
type TypeFilter = 'all' | 'n' | 'v' | 'other';

const MASTERED_OPTIONS: [MasteredFilter, string][] = [
  ['all', '📚 Tất cả'],
  ['active', 'Chưa thuộc'],
  ['mastered', '✅ Đã thuộc'],
  ['flagged', '⭐ Chú ý'],
];
const TYPE_OPTIONS: [TypeFilter, string][] = [
  ['all', 'Tất cả'],
  ['n', 'Danh từ'],
  ['v', 'Động từ'],
  ['other', 'Khác'],
];

/**
 * index.html: openSelectWordsModal()/#selectWordsModal ("Chọn từ luyện
 * tập"). Loads the FULL word pool (buildFullListAll — includes mastered,
 * respects merged-session mode), lets the user narrow it down by
 * search/mastered-status/word-type, and hand-toggle individual checkboxes.
 * Changing any filter re-selects everything currently matching it
 * (index.html's onFilterChange/selectByFilter) — this is real-time
 * selection-by-filter, not just a display filter. "Áp dụng" intersects the
 * manual selection with whatever's currently visible and hands the id list
 * to usePracticeEngine.applyCustomSelection (isCustomMode = true).
 */
interface SelectWordsModalProps {
  visible: boolean;
  onClose: () => void;
  engine: PracticeEngine;
}

export default function SelectWordsModal({ visible, onClose, engine }: SelectWordsModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { vocab, masteredIds, flaggedIds, currentSessionId } = useDataStore();
  const { showToast } = useToast();

  const [allWords, setAllWords] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [selIds, setSelIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [masteredFilter, setMasteredFilter] = useState<MasteredFilter>('active');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [openPicker, setOpenPicker] = useState<'mastered' | 'type' | null>(null);

  // Load the full pool (includeMastered=true) once per open, respecting merged mode
  useEffect(() => {
    if (!visible || !user || !currentSessionId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      let list: Question[];
      if (engine.source === 'merged') {
        const sessIds = engine.mergedSessionIds.length ? engine.mergedSessionIds : [currentSessionId];
        list = await buildMergedQuestionList(user.uid, sessIds, true, {
          getVocab: dbGetSessionVocab,
          getMastered: dbGetMastered,
          getFlagged: dbGetFlagged,
        });
      } else {
        list = buildQuestionList(vocab, masteredIds, flaggedIds, currentSessionId, true);
      }
      if (cancelled) return;
      setAllWords(list);
      // index.html: selIds init = previously saved selection, else ALL ids
      setSelIds(new Set(engine.customWordIds ?? list.map((w) => w.id)));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.uid, currentSessionId, engine.source, engine.mergedSessionIds]);

  const filtered = useMemo(() => {
    let list = allWords;
    if (masteredFilter === 'active') list = list.filter((w) => !w.isMastered);
    else if (masteredFilter === 'mastered') list = list.filter((w) => w.isMastered);
    else if (masteredFilter === 'flagged') list = list.filter((w) => w.isFlagged);

    if (typeFilter !== 'all') {
      list = list.filter((w) => {
        const wt = (w.wordType || '').toLowerCase();
        if (typeFilter === 'n') return wt === 'n' || wt.startsWith('n ');
        if (typeFilter === 'v') return wt === 'v' || wt.startsWith('v ');
        return !(wt === 'n' || wt.startsWith('n ') || wt === 'v' || wt.startsWith('v '));
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((w) => w.fullDisplayGerman.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q));
    }
    return list;
  }, [allWords, masteredFilter, typeFilter, search]);

  // index.html: onFilterChange → selectByFilter() — re-selects EVERYTHING
  // matching the filter that was just changed to (real-time, not additive).
  function selectByNewFilter(nextList: Question[]) {
    setSelIds(new Set(nextList.map((w) => w.id)));
  }

  function toggleWord(id: string) {
    setSelIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleApply() {
    const filteredIds = new Set(filtered.map((w) => w.id));
    const selected = [...selIds].filter((id) => filteredIds.has(id));
    if (!selected.length) {
      showToast('⚠️ Chọn ít nhất 1 từ!');
      return;
    }
    engine.applyCustomSelection(selected);
    showToast(`☑️ Đang luyện ${selected.length} từ đã chọn`);
    onClose();
  }

  const selectedInViewCount = filtered.filter((w) => selIds.has(w.id)).length;

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.tx }]}>☑️ Chọn từ luyện tập</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ color: colors.tx3, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <TextInput
          value={search}
          onChangeText={(t) => {
            setSearch(t);
          }}
          placeholder="🔍 Tìm từ..."
          placeholderTextColor={colors.tx3}
          style={[styles.searchInput, { color: colors.tx, backgroundColor: colors.bg3, borderColor: colors.border }]}
        />
        <FilterPill label={MASTERED_OPTIONS.find(([v]) => v === masteredFilter)?.[1] || ''} onPress={() => setOpenPicker('mastered')} />
        <FilterPill label={TYPE_OPTIONS.find(([v]) => v === typeFilter)?.[1] || ''} onPress={() => setOpenPicker('type')} />
      </View>

      <View style={[styles.listBox, { borderColor: colors.border2 }]}>
        <FlatList
          data={filtered}
          keyExtractor={(w) => w.id}
          style={{ maxHeight: 340 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={{ color: colors.tx3, textAlign: 'center', padding: 20 }}>
              {loading ? 'Đang tải...' : 'Không có từ nào khớp bộ lọc'}
            </Text>
          }
          renderItem={({ item }) => {
            const checked = selIds.has(item.id);
            const tint = item.isMastered ? 'rgba(63,185,80,0.07)' : item.isFlagged ? 'rgba(240,192,0,0.13)' : 'transparent';
            return (
              <Pressable style={[styles.wordRow, { backgroundColor: tint }]} onPress={() => toggleWord(item.id)}>
                <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: checked ? '#58a6ff' : 'transparent' }]}>
                  {checked && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.tx, fontSize: 14.5, fontWeight: '700' }}>
                    {item.fullDisplayGerman}
                    {!!item.wordType && (
                      <Text style={styles.typeBadge}> {item.wordType}</Text>
                    )}
                  </Text>
                  <Text style={{ color: colors.tx3, fontSize: 12, fontFamily: 'DM Mono', marginTop: 2 }}>{item.meaning}</Text>
                  {item.isMastered && <Text style={{ color: '#3fb950', fontSize: 10.5, fontWeight: '700', marginTop: 1 }}>★ đã thuộc</Text>}
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      <View style={styles.footerRow}>
        <Text style={{ color: colors.tx3, fontSize: 12 }}>
          {selectedInViewCount}/{filtered.length}
        </Text>
        <View style={styles.footerBtns}>
          <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={{ color: colors.tx2, fontSize: 13.5 }}>Huỷ</Text>
          </Pressable>
          <View style={{ width: 130 }}>
            <AuthButton label="☑️ Áp dụng" onPress={handleApply} variant="green" />
          </View>
        </View>
      </View>

      <Modal visible={openPicker !== null} transparent animationType="fade" onRequestClose={() => setOpenPicker(null)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setOpenPicker(null)}>
          <View style={[styles.pickerBox, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
            {(openPicker === 'mastered' ? MASTERED_OPTIONS : TYPE_OPTIONS).map(([value, label]) => (
              <Pressable
                key={value}
                style={styles.pickerRow}
                onPress={() => {
                  if (openPicker === 'mastered') setMasteredFilter(value as MasteredFilter);
                  else setTypeFilter(value as TypeFilter);
                  setOpenPicker(null);
                  // recompute the filtered list with the NEW value directly (state update is async)
                  setTimeout(() => {
                    let list = allWords;
                    const mv = openPicker === 'mastered' ? (value as MasteredFilter) : masteredFilter;
                    const tv = openPicker === 'type' ? (value as TypeFilter) : typeFilter;
                    if (mv === 'active') list = list.filter((w) => !w.isMastered);
                    else if (mv === 'mastered') list = list.filter((w) => w.isMastered);
                    else if (mv === 'flagged') list = list.filter((w) => w.isFlagged);
                    if (tv !== 'all') {
                      list = list.filter((w) => {
                        const wt = (w.wordType || '').toLowerCase();
                        if (tv === 'n') return wt === 'n' || wt.startsWith('n ');
                        if (tv === 'v') return wt === 'v' || wt.startsWith('v ');
                        return !(wt === 'n' || wt.startsWith('n ') || wt === 'v' || wt.startsWith('v '));
                      });
                    }
                    selectByNewFilter(list);
                  }, 0);
                }}
              >
                <Text style={{ color: colors.tx, fontSize: 14 }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </BottomSheetModal>
  );
}

function FilterPill({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.filterPill, { borderColor: colors.border, backgroundColor: colors.bg3 }]}>
      <Text style={{ color: colors.tx2, fontSize: 11.5 }} numberOfLines={1}>
        {label} ▾
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  searchInput: { flex: 1.4, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, fontSize: 12.5 },
  filterPill: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  listBox: { borderWidth: 1, borderRadius: 10 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  typeBadge: {
    fontSize: 11,
    color: '#d2a8ff',
    backgroundColor: 'rgba(210,168,255,0.12)',
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  footerBtns: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  cancelBtn: { paddingHorizontal: 18, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  pickerBox: { borderWidth: 1, borderRadius: 12, paddingVertical: 6, minWidth: 200 },
  pickerRow: { paddingVertical: 12, paddingHorizontal: 18 },
});
