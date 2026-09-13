import React from 'react';
import { Modal, View, Pressable, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { mobile } from '@/theme/theme';

/**
 * Maps .modal-overlay / .modal-box on mobile (index.html):
 *  - overlay: align items flex-end (bottom-sheet, not centered)
 *  - box: full width, radius 16px only on top corners, max-height 90%,
 *    slide up from bottom (translateY 40px -> 0)
 * Used for EVERY modal per prompt 1.1 (add/edit word, folder manager,
 * global search, import/export, settings...) — not just this one.
 *
 * KeyboardAvoidingView bên ngoài: những modal có ô nhập liệu (tìm kiếm,
 * thêm/sửa từ...) trước đây bị bàn phím che mất vì overlay không tự đẩy
 * lên khi bàn phím xuất hiện — bọc thêm KeyboardAvoidingView để toàn bộ
 * bottom-sheet trượt lên trên bàn phím.
 */
interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function BottomSheetModal({ visible, onClose, children }: BottomSheetModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.overlay, { backgroundColor: `rgba(0,0,0,${mobile.overlayOpacity})` }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View
            style={[
              styles.box,
              {
                backgroundColor: colors.modalBg,
                borderColor: colors.border,
                paddingBottom: 18 + insets.bottom,
                maxHeight: `${mobile.modalMaxHeightPercent * 100}%`,
              },
            ]}
          >
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  box: {
    borderTopLeftRadius: mobile.modalRadiusTop,
    borderTopRightRadius: mobile.modalRadiusTop,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 18,
    paddingHorizontal: 14,
    ...Platform.select({ android: { elevation: 8 }, ios: {} }),
  },
});
