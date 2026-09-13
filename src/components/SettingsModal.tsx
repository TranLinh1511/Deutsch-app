import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/theme/ThemeContext';
import { useSettings } from '@/store/SettingsContext';
import { useToast } from '@/store/ToastContext';
import { useAuth } from '@/store/AuthContext';
import { ensureNotificationPermission } from '@/services/vocabNotifications';
import { resetExportDirectory } from '@/services/importExport';
import { IMAGE_VOCAB_EXTRACTION_PROMPT } from '@/constants/prompts';
import BottomSheetModal from './BottomSheetModal';
import NotificationSettingsPopup from './NotificationSettingsPopup';
import BreakSettingsPopup from './BreakSettingsPopup';
import Icon from './Icon';
import type { PracticeEngine } from '@/hooks/usePracticeEngine';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  engine: PracticeEngine;
}

/**
 * Settings panel — combines index.html's settings sidebar sections:
 *  - Sound toggle (`soundEnabled`)
 *  - "Nghỉ giải lao" break timer section (`breakEnabled`/Work+Rest minutes)
 *  - Per-exercise toggles that were introduced in usePracticeEngine back in
 *    Phase 5 (onlyUnmastered, strictVocabCheck, randomMode,
 *    autoAdvanceOnCorrect, studyMode, allowSkip, wordLimit) — exposed here
 *    as promised in the Phase 5/7 notes.
 */
export default function SettingsModal({ visible, onClose, engine }: SettingsModalProps) {
  const { colors, mode, toggleMode } = useTheme();
  const { user, logout } = useAuth();
  const {
    soundEnabled,
    toggleSound,
    breakEnabled,
    setBreakEnabled,
    breakWorkMinutes,
    breakRestMinutes,
    notifEnabled,
    setNotifEnabled,
    notifIntervalMinutes,
    autoHideHint,
    setAutoHideHint,
  } = useSettings();
  const { showToast } = useToast();
  const [notifPopupVisible, setNotifPopupVisible] = useState(false);
  const [breakPopupVisible, setBreakPopupVisible] = useState(false);

  // Xin quyền NGAY khi người dùng bật công tắc (không đợi effect nền chạy
  // xong mới biết có bị từ chối hay không) — nếu hệ điều hành từ chối, báo
  // rõ bằng toast và không bật công tắc lên.
  const handleToggleNotif = async () => {
    if (!notifEnabled) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        showToast('Cần cấp quyền thông báo trong Cài đặt máy để bật tính năng này');
        return;
      }
    }
    setNotifEnabled(!notifEnabled);
  };

  // Đóng modal trước rồi mới đăng xuất — RootNavigator tự chuyển sang màn
  // hình đăng nhập ngay khi AuthContext báo user === null, nên không cần
  // tự điều hướng ở đây.
  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const handleCopyPrompt = async () => {
    await Clipboard.setStringAsync(IMAGE_VOCAB_EXTRACTION_PROMPT);
    showToast('Đã sao chép prompt vào bộ nhớ tạm');
  };

  // Xoá thư mục SAF đã lưu (Download/deutsch...) — lần xuất file tiếp theo
  // sẽ hỏi lại người dùng chọn/tạo thư mục mới. Chỉ có ý nghĩa trên
  // Android (xem services/importExport.ts).
  const handleResetExportDir = async () => {
    await resetExportDirectory();
    showToast('Lần xuất file tiếp theo sẽ hỏi lại thư mục lưu');
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.tx }]}>
          <Icon name="cog" size={15} color={colors.tx} />{'  '}Cài đặt
        </Text>

        <SectionLabel text="TÀI KHOẢN" />
        <View style={styles.accountRow}>
          <View style={[styles.avatar, { backgroundColor: '#2dd48f' }]}>
            <Text style={styles.avatarText}>{(user?.displayName || 'U').trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.accountName, { color: colors.tx }]} numberOfLines={1}>
              {user?.displayName || 'Người dùng'}
            </Text>
            <Text style={[styles.accountSub, { color: colors.tx3 }]}>Đã đăng nhập</Text>
          </View>
          <Pressable
            onPress={handleLogout}
            style={[styles.logoutBtn, { backgroundColor: 'rgba(248,81,73,0.1)', borderColor: 'rgba(248,81,73,0.4)' }]}
          >
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </Pressable>
        </View>

        <SectionLabel text="GIAO DIỆN" />
        <ToggleRow
          label={mode === 'light' ? 'Giao diện sáng' : 'Giao diện tối'}
          icon={mode === 'light' ? 'sun' : 'moon'}
          value={mode === 'light'}
          onToggle={toggleMode}
        />

        <SectionLabel text="ÂM THANH" />
        <ToggleRow label="Bật âm thanh / TTS" icon="volume-up" value={soundEnabled} onToggle={toggleSound} />

        <SectionLabel text="LUYỆN TẬP" />
        <ToggleRow
          label="Chỉ luyện từ chưa thuộc"
          value={engine.onlyUnmastered}
          onToggle={() => engine.setOnlyUnmastered(!engine.onlyUnmastered)}
        />
        <ToggleRow
          label="Kiểm tra chặt (không rút gọn động từ)"
          value={engine.strictVocabCheck}
          onToggle={() => engine.setStrictVocabCheck(!engine.strictVocabCheck)}
        />
        <ToggleRow label="Xáo trộn ngẫu nhiên" value={engine.randomMode} onToggle={() => engine.setRandomMode(!engine.randomMode)} />
        <ToggleRow
          label="Tự động qua câu khi đúng"
          value={engine.autoAdvanceOnCorrect}
          onToggle={() => engine.setAutoAdvanceOnCorrect(!engine.autoAdvanceOnCorrect)}
        />
        <ToggleRow label="Chế độ học (không tự qua câu)" value={engine.studyMode} onToggle={() => engine.setStudyMode(!engine.studyMode)} />
        <ToggleRow label="Cho phép bỏ qua câu" value={engine.allowSkip} onToggle={() => engine.setAllowSkip(!engine.allowSkip)} />
        <ToggleRow label="Tự tắt gợi ý khi sang từ tiếp theo" value={autoHideHint} onToggle={() => setAutoHideHint(!autoHideHint)} />

        <NumberRow
          label="Số từ / lượt (0 = không giới hạn)"
          value={engine.wordLimit}
          onChange={engine.setWordLimit}
        />

        <SectionLabel text="TIỆN ÍCH" />
        <View style={styles.row}>
          <Text style={{ color: colors.tx, fontSize: 13.5, flex: 1 }}>Prompt trích xuất từ vựng từ hình ảnh</Text>
          <Pressable
            onPress={handleCopyPrompt}
            style={[styles.copyBtn, { backgroundColor: colors.bg3, borderColor: colors.border }]}
          >
            <Icon name="copy" size={12} color={colors.tx} />
            <Text style={{ color: colors.tx, fontSize: 13, fontWeight: '600', marginLeft: 8 }}>Sao chép</Text>
          </Pressable>
        </View>

        {Platform.OS === 'android' && (
          <View style={styles.row}>
            <Text style={{ color: colors.tx, fontSize: 13.5, flex: 1 }}>Thư mục lưu file xuất</Text>
            <Pressable
              onPress={handleResetExportDir}
              style={[styles.copyBtn, { backgroundColor: colors.bg3, borderColor: colors.border }]}
            >
              <Icon name="folder" size={12} color={colors.tx} />
              <Text style={{ color: colors.tx, fontSize: 13, fontWeight: '600', marginLeft: 8 }}>Đổi</Text>
            </Pressable>
          </View>
        )}

        <SectionLabel text="THÔNG BÁO" />
        <View style={styles.row}>
          <Pressable style={{ flex: 1 }} onPress={() => setNotifPopupVisible(true)} hitSlop={4}>
            <Text style={{ color: colors.tx, fontSize: 13.5 }}>
              Thông báo từ vựng ngẫu nhiên
              {notifEnabled ? ` · mỗi ${notifIntervalMinutes}p` : ''}
            </Text>
          </Pressable>
          <Pressable style={styles.switch2} onPress={handleToggleNotif}>
            <View style={[styles.switch, { backgroundColor: notifEnabled ? '#3fb950' : colors.bg3, borderColor: colors.border }]}>
              <View style={[styles.knob, { alignSelf: notifEnabled ? 'flex-end' : 'flex-start' }]} />
            </View>
          </Pressable>
        </View>

        <SectionLabel text="NGHỈ GIẢI LAO" />
        <View style={styles.row}>
          <Pressable style={{ flex: 1 }} onPress={() => setBreakPopupVisible(true)} hitSlop={4}>
            <Text style={{ color: colors.tx, fontSize: 13.5 }}>
              Bật nhắc nghỉ
              {breakEnabled ? ` · học ${breakWorkMinutes}p, nghỉ ${breakRestMinutes}p` : ''}
            </Text>
          </Pressable>
          <Pressable style={styles.switch2} onPress={() => setBreakEnabled(!breakEnabled)}>
            <View style={[styles.switch, { backgroundColor: breakEnabled ? '#3fb950' : colors.bg3, borderColor: colors.border }]}>
              <View style={[styles.knob, { alignSelf: breakEnabled ? 'flex-end' : 'flex-start' }]} />
            </View>
          </Pressable>
        </View>
      </ScrollView>
      <NotificationSettingsPopup visible={notifPopupVisible} onClose={() => setNotifPopupVisible(false)} />
      <BreakSettingsPopup visible={breakPopupVisible} onClose={() => setBreakPopupVisible(false)} />
    </BottomSheetModal>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.section, { color: colors.tx3 }]}>{text}</Text>;
}

function ToggleRow({
  label,
  value,
  onToggle,
  icon,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  icon?: React.ComponentProps<typeof Icon>['name'];
}) {
  const { colors } = useTheme();
  return (
    <Pressable style={styles.row} onPress={onToggle}>
      <Text style={{ color: colors.tx, fontSize: 13.5, flex: 1 }}>
        {icon ? (
          <>
            <Icon name={icon} size={12} color={colors.tx} />{'  '}
          </>
        ) : null}
        {label}
      </Text>
      <View style={[styles.switch, { backgroundColor: value ? '#3fb950' : colors.bg3, borderColor: colors.border }]}>
        <View style={[styles.knob, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: colors.tx, fontSize: 13.5, flex: 1 }}>{label}</Text>
      <TextInput
        keyboardType="number-pad"
        value={String(value)}
        onChangeText={(t) => {
          const n = Math.max(min, Math.min(max, parseInt(t, 10) || 0));
          onChange(n);
        }}
        style={[styles.numInput, { color: colors.tx, backgroundColor: colors.bg3, borderColor: colors.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', marginBottom: 14 },
  section: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  switch2: { flexShrink: 0 },
  switch: { width: 42, height: 24, borderRadius: 12, borderWidth: 1, padding: 2, justifyContent: 'center' },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  numInput: { width: 56, borderWidth: 1.5, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, textAlign: 'center', fontSize: 13.5 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#0d1117', fontSize: 16, fontWeight: '700' },
  accountName: { fontSize: 14.5, fontWeight: '700' },
  accountSub: { fontSize: 12, marginTop: 1 },
  logoutBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1 },
  logoutText: { color: '#f85149', fontSize: 13, fontWeight: '700' },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
  },
});
