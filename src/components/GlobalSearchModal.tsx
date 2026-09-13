import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useDataStore } from '@/store/DataStore';
import { dbGetSessionVocab } from '@/services/firebase/words';
import { dbGetMastered, dbGetFlagged } from '@/services/firebase/masteredFlagged';
import { normSearch } from '@/utils/grading';
import { getSearchHistory, pushSearchHistory, removeFromSearchHistory } from '@/services/searchHistory';
import BottomSheetModal from './BottomSheetModal';
import Icon from './Icon';
import type { VocabWord } from '@/types/models';

interface SearchResult extends VocabWord {
  _sessId: string;
  _sessName: string;
  _isMastered: boolean;
  _isFlagged: boolean;
}

/** index.html: openGlobalSearchModal()/runGlobalSearch(q) — searches across ALL sessions, grouped by session */
interface GlobalSearchModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function GlobalSearchModal({ visible, onClose }: GlobalSearchModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { sessions, switchSession } = useDataStore();
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (visible) getSearchHistory().then(setHistory);
  }, [visible]);

  async function runSearch(q: string) {
    if (!user || !q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const needle = normSearch(q.trim());
    const all: SearchResult[] = [];
    for (const sess of sessions) {
      const [vocab, mIds, fIds] = await Promise.all([
        dbGetSessionVocab(user.uid, sess.id),
        dbGetMastered(user.uid, sess.id),
        dbGetFlagged(user.uid, sess.id),
      ]);
      vocab.forEach((item) => {
        if (normSearch(item.originalGerman).includes(needle) || normSearch(item.meaning).includes(needle)) {
          all.push({ ...item, _sessId: sess.id, _sessName: sess.name, _isMastered: mIds.has(item.id), _isFlagged: fIds.has(item.id) });
        }
      });
    }
    setResults(all);
    setSearching(false);
  }

  async function handleSubmit() {
    await runSearch(query);
    if (query.trim().length >= 2) setHistory(await pushSearchHistory(query.trim()));
  }

  async function handleSelectHistory(h: string) {
    setQuery(h);
    await runSearch(h);
  }

  async function handleRemoveHistory(h: string) {
    setHistory(await removeFromSearchHistory(h));
  }

  async function handleResultPress(r: SearchResult) {
    await switchSession(r._sessId);
    onClose();
  }

  // Group results by session for display
  const grouped = results.reduce<Record<string, { name: string; items: SearchResult[] }>>((acc, r) => {
    if (!acc[r._sessId]) acc[r._sessId] = { name: r._sessName, items: [] };
    acc[r._sessId].items.push(r);
    return acc;
  }, {});

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={[styles.title, { color: colors.tx }]}>
        <Icon name="search" size={14} color={colors.tx} />{'  '}Tìm kiếm toàn bộ
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSubmit}
          placeholder="Nhập từ tiếng Đức hoặc nghĩa..."
          placeholderTextColor={colors.tx3}
          style={[styles.input, { color: colors.tx, backgroundColor: colors.bg3, borderColor: colors.border }]}
          autoFocus
        />
        {!!query && (
          <Pressable
            onPress={() => {
              setQuery('');
              setResults([]);
            }}
            hitSlop={8}
          >
            <Icon name="times" size={15} color={colors.tx3} />
          </Pressable>
        )}
      </View>

      {!query && history.length > 0 && (
        <View style={styles.historyWrap}>
          {history.map((h) => (
            <View key={h} style={[styles.historyChip, { borderColor: colors.border, backgroundColor: colors.bg3 }]}>
              <Pressable onPress={() => handleSelectHistory(h)}>
                <Text style={{ color: colors.tx2, fontSize: 12 }}>{h}</Text>
              </Pressable>
              <Pressable onPress={() => handleRemoveHistory(h)} hitSlop={6}>
                <Icon name="times" size={10} color={colors.tx3} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {query.trim() && (
        <Text style={{ color: colors.tx3, fontSize: 12, marginBottom: 8 }}>
          {searching ? 'Đang tìm...' : results.length ? `${results.length} kết quả trong ${Object.keys(grouped).length} phiên` : ''}
        </Text>
      )}

      <FlatList
        data={Object.entries(grouped)}
        keyExtractor={([sid]) => sid}
        style={{ maxHeight: 340 }}
        ListEmptyComponent={
          query.trim() && !searching ? (
            <Text style={{ color: colors.tx3, textAlign: 'center', padding: 20 }}>Không tìm thấy từ nào</Text>
          ) : null
        }
        renderItem={({ item: [sid, group] }) => (
          <View style={{ marginBottom: 6 }}>
            <Text style={[styles.groupLabel, { color: colors.tx3 }]}>{group.name}</Text>
            {group.items.map((r) => (
              <Pressable key={r.id} style={styles.resultRow} onPress={() => handleResultPress(r)}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.tx, fontSize: 13.5, fontWeight: '600' }}>
                    {r.originalGerman}
                    {r.wordType ? <Text style={{ color: colors.tx3, fontSize: 11 }}> {r.wordType}</Text> : null}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.tx3, fontSize: 12 }}>{r.meaning}</Text>
                </View>
                {r._isMastered && <Icon name="star" size={10} color="#3fb950" />}
                {r._isFlagged && !r._isMastered && <Icon name="star" size={10} color={colors.tx} />}
              </Pressable>
            ))}
          </View>
        )}
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  input: { flex: 1, borderWidth: 1.5, borderRadius: 9, padding: 11, fontSize: 14 },
  historyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  groupLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, paddingHorizontal: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4 },
});
