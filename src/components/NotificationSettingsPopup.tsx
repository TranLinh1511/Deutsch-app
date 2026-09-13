import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { accent } from '@/theme/theme';
import { useSettings } from '@/store/SettingsContext';
import { NOTIF_INTERVAL_MIN_MINUTES, NOTIF_INTERVAL_MAX_MINUTES } from '@/services/vocabNotifications';
import BottomSheetModal from './BottomSheetModal';
import Icon from './Icon';

interface NotificationSettingsPopupProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Popup nhỏ mở ra khi bấm icon ⚙️ cạnh "Thông báo từ vựng ngẫu nhiên" trong
 * SettingsModal — chỉ để chỉnh CHU KỲ lặp lại (bao nhiêu phút/giờ một
 * lần), tách riêng khỏi công tắc bật/tắt (công tắc đó vẫn nằm ngay ở hàng
 * chính, bấm là ăn liền, không cần mở popup).
 */
export default function NotificationSettingsPopup({ visible, onClose }: NotificationSettingsPopupProps) {
  const { colors } = useTheme();
  const { notifIntervalMinutes, setNotifIntervalMinutes } = useSettings();
  const [draft, setDraft] = useState(String(notifIntervalMinutes));

  // Nạp lại giá trị đang lưu mỗi lần mở popup, để không giữ bản nháp cũ từ
  // lần mở trước (vd. người dùng gõ dở rồi bấm ra ngoài đóng popup mà
  // không lưu).
  useEffect(() => {
    if (visible) setDraft(String(notifIntervalMinutes));
  }, [visible, notifIntervalMinutes]);

  const parsed = Math.max(NOTIF_INTERVAL_MIN_MINUTES, Math.min(NOTIF_INTERVAL_MAX_MINUTES, parseInt(draft, 10) || 0));
  const h = Math.floor(parsed / 60);
  const m = parsed % 60;
  const humanReadable = h > 0 ? `${h} giờ${m ? ` ${m} phút` : ''}` : `${m} phút`;

  const handleSave = () => {
    setNotifIntervalMinutes(parsed);
    onClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={[styles.title, { color: colors.tx, flexDirection: 'row', alignItems: 'center' }]}>
        <Icon name="bell" size={14} color={colors.tx} />{'  '}Chu kỳ nhắc từ vựng
      </Text>
      <Text style={{ color: colors.tx2, fontSize: 13, marginBottom: 14 }}>
        Cứ sau bao nhiêu phút thì nhắc lại một lần bằng một từ ngẫu nhiên trong phiên đang học.
      </Text>

      <View style={styles.row}>
        <Text style={{ color: colors.tx, fontSize: 13.5, flex: 1 }}>Nhắc lại sau mỗi (phút)</Text>
        <TextInput
          keyboardType="number-pad"
          value={draft}
          onChangeText={setDraft}
          style={[styles.numInput, { color: colors.tx, backgroundColor: colors.bg3, borderColor: colors.border }]}
        />
      </View>
      <Text style={{ color: colors.tx3, fontSize: 11.5, marginBottom: 16 }}>
        ≈ {humanReadable} một lần (tối thiểu {NOTIF_INTERVAL_MIN_MINUTES} phút, tối đa {Math.round(NOTIF_INTERVAL_MAX_MINUTES / 60)} giờ).
      </Text>

      <Pressable style={[styles.saveBtn, { backgroundColor: accent.blue }]} onPress={handleSave}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Lưu</Text>
      </Pressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  numInput: { width: 64, borderWidth: 1.5, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, textAlign: 'center', fontSize: 13.5 },
  saveBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4, marginBottom: 8 },
});
