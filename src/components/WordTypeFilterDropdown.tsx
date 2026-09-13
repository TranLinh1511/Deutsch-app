import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { accent } from '@/theme/theme';
import BottomSheetModal from './BottomSheetModal';
import Icon from './Icon';

export interface WordTypeGroup {
  key: string;
  label: string;
  count: number;
}

/**
 * Bộ lọc "Loại từ" kiểu Excel (AutoFilter) — bấm vào ô loại từ trong cột,
 * hiện ra 1 popup có:
 *  - 2 nút sắp xếp ở trên cùng (giống "Sort A to Z" / "Sort Z to A" của
 *    Excel) — ở đây chỉ có 1 kiểu sắp xếp có ý nghĩa (gộp theo nhóm loại
 *    từ) nên rút gọn thành 1 công tắc bật/tắt "Sắp xếp theo loại từ".
 *  - Dòng "(Tất cả)" tick/bỏ tick TẤT CẢ 1 lượt, giống "(Select All)".
 *  - Danh sách checkbox từng loại từ kèm số lượng, tick = đang nghe loại
 *    đó, bỏ tick = ẩn khỏi lượt nghe hiện tại.
 *
 * NHẬN STATE TỪ NGOÀI QUA PROPS (không tự đọc ListenModeContext nữa): popup
 * "Cài đặt nghe" (ListenModeModal) giờ giữ 1 bản NHÁP của mọi cài đặt, chỉ
 * áp dụng thật khi bấm "Lưu cài đặt" — nên bộ lọc loại từ ở đây cũng phải
 * thao tác trên bản nháp đó, không được ghi thẳng vào context như trước.
 */
export default function WordTypeFilterDropdown({
  visible,
  onClose,
  wordTypeGroups,
  wordTypeFilter,
  onToggle,
  onSelectAll,
  sortByWordType,
  onToggleSort,
}: {
  visible: boolean;
  onClose: () => void;
  wordTypeGroups: WordTypeGroup[];
  wordTypeFilter: string[] | null;
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  sortByWordType: boolean;
  onToggleSort: () => void;
}) {
  const { colors } = useTheme();
  const allSelected = wordTypeFilter === null;
  const selectedCount = allSelected ? wordTypeGroups.length : wordTypeFilter!.length;

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.tx }]}>
          <Icon name="filter" size={14} color={colors.tx} />
          {'  '}Lọc loại từ
        </Text>
        <Pressable onPress={onClose} hitSlop={8} style={[styles.closeBtn, { backgroundColor: colors.bg3, borderColor: colors.border }]}>
          <Icon name="times" size={13} color={colors.tx2} />
        </Pressable>
      </View>

      <Pressable
        onPress={onToggleSort}
        style={[
          styles.sortRow,
          {
            backgroundColor: sortByWordType ? 'rgba(88,166,255,0.12)' : colors.bg3,
            borderColor: sortByWordType ? accent.blue : colors.border,
          },
        ]}
      >
        <Icon name="sort-amount-down" size={13} color={sortByWordType ? accent.blue : colors.tx2} />
        <Text style={{ color: sortByWordType ? accent.blue : colors.tx2, fontSize: 13, fontWeight: '600', marginLeft: 8, flex: 1 }}>
          Sắp xếp theo loại từ (gộp cùng nhóm lại gần nhau)
        </Text>
        <Icon name={sortByWordType ? 'check-square' : 'square'} size={16} color={sortByWordType ? accent.blue : colors.tx3} solid={sortByWordType} />
      </Pressable>

      <View style={[styles.divider, { backgroundColor: colors.border2 }]} />

      <Text style={{ color: colors.tx3, fontSize: 11, marginBottom: 8 }}>
        Đang nghe {selectedCount}/{wordTypeGroups.length} loại từ
      </Text>

      <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
        <CheckRow
          label="(Tất cả)"
          count={wordTypeGroups.reduce((s, g) => s + g.count, 0)}
          checked={allSelected}
          onPress={onSelectAll}
          bold
        />
        {wordTypeGroups.map((g) => (
          <CheckRow
            key={g.key}
            label={g.label}
            count={g.count}
            checked={allSelected || wordTypeFilter!.includes(g.key)}
            onPress={() => onToggle(g.key)}
          />
        ))}
      </ScrollView>

      <View style={{ height: 6 }} />
    </BottomSheetModal>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onPress,
  bold = false,
}: {
  label: string;
  count: number;
  checked: boolean;
  onPress: () => void;
  bold?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.checkRow} hitSlop={2}>
      <Icon name={checked ? 'check-square' : 'square'} size={17} color={checked ? accent.blue : colors.tx3} solid={checked} />
      <Text style={{ color: colors.tx, fontSize: 13.5, fontWeight: bold ? '700' : '500', marginLeft: 10, flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: colors.tx3, fontSize: 12 }}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700' },
  closeBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sortRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 2 },
});
