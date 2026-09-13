import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { accent } from '@/theme/theme';
import { useSettings } from '@/store/SettingsContext';
import BottomSheetModal from './BottomSheetModal';
import Icon from './Icon';

interface BreakSettingsPopupProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Popup mở khi bấm hàng "Bật nhắc nghỉ" trong SettingsModal — chỉnh số
 * phút học liên tục / nghỉ, tách khỏi công tắc bật/tắt (công tắc vẫn ở
 * ngay hàng chính, bấm là ăn liền), giống NotificationSettingsPopup.
 */
export default function BreakSettingsPopup({ visible, onClose }: BreakSettingsPopupProps) {
  const { colors } = useTheme();
  const { breakWorkMinutes, setBreakWorkMinutes, breakRestMinutes, setBreakRestMinutes } = useSettings();
  const [work, setWork] = useState(String(breakWorkMinutes));
  const [rest, setRest] = useState(String(breakRestMinutes));

  useEffect(() => {
    if (visible) {
      setWork(String(breakWorkMinutes));
      setRest(String(breakRestMinutes));
    }
  }, [visible, breakWorkMinutes, breakRestMinutes]);

  const parsedWork = Math.max(1, Math.min(180, parseInt(work, 10) || 0));
  const parsedRest = Math.max(1, Math.min(60, parseInt(rest, 10) || 0));

  const handleSave = () => {
    setBreakWorkMinutes(parsedWork);
    setBreakRestMinutes(parsedRest);
    onClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={[styles.title, { color: colors.tx }]}>
        <Icon name="coffee" size={14} color={colors.tx} />{'  '}Nhắc nghỉ giải lao
      </Text>

      <View style={styles.row}>
        <Text style={{ color: colors.tx, fontSize: 13.5, flex: 1 }}>Học liên tục (phút)</Text>
        <TextInput
          keyboardType="number-pad"
          value={work}
          onChangeText={setWork}
          style={[styles.numInput, { color: colors.tx, backgroundColor: colors.bg3, borderColor: colors.border }]}
        />
      </View>
      <View style={styles.row}>
        <Text style={{ color: colors.tx, fontSize: 13.5, flex: 1 }}>Nghỉ (phút)</Text>
        <TextInput
          keyboardType="number-pad"
          value={rest}
          onChangeText={setRest}
          style={[styles.numInput, { color: colors.tx, backgroundColor: colors.bg3, borderColor: colors.border }]}
        />
      </View>

      <Pressable style={[styles.saveBtn, { backgroundColor: accent.blue }]} onPress={handleSave}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Lưu</Text>
      </Pressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  numInput: { width: 64, borderWidth: 1.5, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, textAlign: 'center', fontSize: 13.5 },
  saveBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8, marginBottom: 8 },
});
