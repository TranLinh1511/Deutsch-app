import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Keyboard, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { mobile } from '@/theme/theme';
import Icon from '@/components/Icon';

interface BatchPillProps {
  visible: boolean;
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * index.html: #mobBatchInfo — only visible when a wordLimit (batch size) is
 * set.
 *
 * Pill được canh vị trí tuyệt đối theo bottom-inset, nên khi bàn phím mở
 * lên (ô "Nhập câu trả lời") nó bị che khuất phía sau bàn phím. Theo dõi
 * sự kiện bàn phím và cộng thêm chiều cao bàn phím vào khoảng cách bottom
 * để pill luôn nổi ngay phía trên bàn phím, animate mượt theo cùng
 * duration/easing mà hệ điều hành dùng để mở/đóng bàn phím.
 */
function BatchPill({ visible, current, total, onPrev, onNext }: BatchPillProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // iOS bắn "will" trước khi bàn phím thực sự di chuyển nên animate theo
    // kịp lúc; Android không hỗ trợ "will" đáng tin cậy nên dùng "did".
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardHeight, {
        toValue: e.endCoordinates?.height ?? 0,
        duration: e.duration && e.duration > 0 ? e.duration : 220,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: e.duration && e.duration > 0 ? e.duration : 200,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeight]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          backgroundColor: colors.bg2,
          borderColor: colors.border,
          bottom: Animated.add(keyboardHeight, mobile.batchPillBottom + insets.bottom),
          right: mobile.batchPillRight,
        },
      ]}
    >
      <Pressable onPress={onPrev} disabled={current <= 0} hitSlop={6}>
        <Icon name="chevron-left" size={12} color={current <= 0 ? colors.tx3 : colors.tx} />
      </Pressable>
      <Text style={{ color: colors.tx2, fontSize: 12, fontWeight: '600' }}>
        {current + 1}/{total}
      </Text>
      <Pressable onPress={onNext} disabled={current + 1 >= total} hitSlop={6}>
        <Icon name="chevron-right" size={12} color={current + 1 >= total ? colors.tx3 : colors.tx} />
      </Pressable>
    </Animated.View>
  );
}

export default React.memo(BatchPill);

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: mobile.batchPillRadius,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
});
