import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { mobile, fonts } from '@/theme/theme';
import Icon from '@/components/Icon';
import type { ExerciseType, ExerciseMode } from '@/utils/questionBuilder';

const TYPE_OPTIONS: [ExerciseType, string][] = [
  ['fullWord', 'Nguyên từ'],
  ['fullMeaning', 'Nghĩa'],
  ['mixedRandom', 'Hỗn hợp'],
  ['fullSentence', 'Nhập câu'],
];
const MODE_OPTIONS: [ExerciseMode, string][] = [
  ['write', 'Viết'],
  ['choose', 'Chọn'],
  ['listen', 'Nghe'],
  ['speak', 'Phát âm'],
];

interface MobileStatsBarProps {
  correct: number;
  total: number;
  exerciseType: ExerciseType;
  onChangeExerciseType: (t: ExerciseType) => void;
  exerciseMode: ExerciseMode;
  onChangeExerciseMode: (m: ExerciseMode) => void;
  onReset: () => void;
}

/**
 * index.html: #mobileStatsBar row 1 — "✓ correct/total  pct" on the left,
 * `#mobExerciseTypeSelect` + `#mobModeSelect` + `#mobResetBtn` pushed to
 * the right (ml-auto), all in ONE row. Native <select> doesn't exist in
 * RN, so each dropdown opens a small bottom sheet of options on tap —
 * same two underlying values (`exerciseType`/`exerciseMode`), same options.
 */
function MobileStatsBar({
  correct,
  total,
  exerciseType,
  onChangeExerciseType,
  exerciseMode,
  onChangeExerciseMode,
  onReset,
}: MobileStatsBarProps) {
  const { colors } = useTheme();
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const [openPicker, setOpenPicker] = useState<'type' | 'mode' | null>(null);

  return (
    <View style={[styles.bar, { backgroundColor: colors.bg2, borderBottomColor: colors.border }]}>
      <Text style={[styles.statsText, { color: colors.tx2, fontFamily: fonts.mono }]}>
        <Icon name="check" size={10} color="#3fb950" /> <Text style={{ color: '#3fb950', fontWeight: '700' }}>{correct}</Text>/{total}{'  '}
        <Text style={{ color: colors.tx3 }}>{pct}%</Text>
      </Text>

      <View style={styles.rightRow}>
        <DropdownPill
          label={TYPE_OPTIONS.find(([v]) => v === exerciseType)?.[1] || ''}
          onPress={() => setOpenPicker('type')}
        />
        <DropdownPill
          label={MODE_OPTIONS.find(([v]) => v === exerciseMode)?.[1] || ''}
          onPress={() => setOpenPicker('mode')}
        />
        <Pressable onPress={onReset} hitSlop={6} style={[styles.resetBtn, { borderColor: colors.border }]}>
          <Icon name="sync-alt" size={12} color={colors.tx2} />
        </Pressable>
      </View>

      <Modal visible={openPicker !== null} transparent animationType="fade" onRequestClose={() => setOpenPicker(null)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setOpenPicker(null)}>
          <View style={[styles.pickerBox, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
            {(openPicker === 'type' ? TYPE_OPTIONS : MODE_OPTIONS).map(([value, label]) => {
              const isActive = openPicker === 'type' ? value === exerciseType : value === exerciseMode;
              return (
                <Pressable
                  key={value}
                  style={[styles.pickerRow, isActive && { backgroundColor: 'rgba(88,166,255,0.12)' }]}
                  onPress={() => {
                    if (openPicker === 'type') onChangeExerciseType(value as ExerciseType);
                    else onChangeExerciseMode(value as ExerciseMode);
                    setOpenPicker(null);
                  }}
                >
                  <Text style={{ color: isActive ? '#58a6ff' : colors.tx, fontSize: 14, fontWeight: isActive ? '700' : '400' }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default React.memo(MobileStatsBar);

function DropdownPill({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.dropdownPill, { borderColor: colors.border, backgroundColor: colors.bg3 }]}>
      <Text style={{ color: colors.tx2, fontSize: 11.5 }}>{label} </Text>
      <Icon name="chevron-down" size={8} color={colors.tx2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: mobile.statsBarPaddingV,
    paddingHorizontal: mobile.statsBarPaddingH,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  statsText: { fontSize: 12.16 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dropdownPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  resetBtn: { borderWidth: 1, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 7 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  pickerBox: { borderWidth: 1, borderRadius: 12, paddingVertical: 6, minWidth: 180 },
  pickerRow: { paddingVertical: 11, paddingHorizontal: 18 },
});
