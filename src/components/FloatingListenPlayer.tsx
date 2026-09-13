import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { accent } from '@/theme/theme';
import { useListenModeCtx } from '@/store/ListenModeContext';
import Icon from './Icon';

const BUBBLE_SIZE = 56;
const DRAG_THRESHOLD = 6; // px — dưới ngưỡng này coi là "chạm", không phải "kéo"

/**
 * Nút play lơ lửng trên màn hình khi "Nghe từ vựng" đã bị thu nhỏ
 * (ListenModeContext.minimize()). Sống ở gốc app (App.tsx) nên hiển thị
 * xuyên suốt mọi màn hình, không phụ thuộc màn hình đang mở.
 *  - Kéo thả tự do (PanResponder, tự kẹp trong biên màn hình).
 *  - Chạm (không kéo) → mở lại modal đầy đủ.
 *  - Bấm nút ▶/⏸ nhỏ bên trong → phát/tạm dừng ngay tại chỗ.
 */
export default function FloatingListenPlayer() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const listen = useListenModeCtx();
  const win = Dimensions.get('window');

  const initial = { x: win.width - BUBBLE_SIZE - 16, y: win.height - BUBBLE_SIZE - insets.bottom - 140 };
  const pan = useRef(new Animated.ValueXY(initial)).current;
  // Theo dõi vị trí hiện tại bằng listener thay vì đọc thuộc tính nội bộ
  // (_value) của Animated.Value — tránh dùng API riêng tư/không chính thức.
  const posRef = useRef(initial);
  useRef(
    pan.addListener((v) => {
      posRef.current = v;
    })
  );
  const dragDistance = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        dragDistance.current = 0;
        pan.setOffset(posRef.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_evt, gesture) => {
        dragDistance.current = Math.max(dragDistance.current, Math.abs(gesture.dx) + Math.abs(gesture.dy));
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_evt, gesture);
      },
      onPanResponderRelease: (_evt, gesture) => {
        pan.flattenOffset();
        const w = Dimensions.get('window');
        const clampedX = Math.min(Math.max(posRef.current.x, 8), w.width - BUBBLE_SIZE - 8);
        const clampedY = Math.min(Math.max(posRef.current.y, insets.top + 8), w.height - BUBBLE_SIZE - insets.bottom - 8);
        Animated.spring(pan, { toValue: { x: clampedX, y: clampedY }, useNativeDriver: false, friction: 7 }).start();

        if (dragDistance.current < DRAG_THRESHOLD && Math.abs(gesture.dx) < DRAG_THRESHOLD && Math.abs(gesture.dy) < DRAG_THRESHOLD) {
          listen.expand();
        }
      },
    })
  ).current;

  if (!listen.minimized || !listen.words.length) return null;

  const pct = listen.total ? ((listen.wordIndex + 1) / listen.total) * 100 : 0;

  return (
    <Animated.View
      style={[styles.wrap, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <View style={[styles.bubble, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
        <View style={[styles.ring, { borderColor: colors.border2 }]}>
          <View style={[styles.ringFill, { borderColor: accent.blue, transform: [{ rotate: `${(pct / 100) * 360}deg` }] }]} />
        </View>
        <Pressable
          onPress={() => listen.togglePlay()}
          hitSlop={10}
          style={[styles.playDot, { backgroundColor: accent.blue }]}
        >
          <Icon name={listen.isPlaying ? 'pause' : 'play'} size={14} color="#fff" />
        </Pressable>
      </View>
      <Pressable onPress={listen.close} hitSlop={8} style={[styles.closeDot, { backgroundColor: colors.bg3, borderColor: colors.border }]}>
        <Icon name="times" size={8} color={colors.tx2} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 999,
    elevation: 12,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  ring: {
    position: 'absolute',
    width: BUBBLE_SIZE - 6,
    height: BUBBLE_SIZE - 6,
    borderRadius: (BUBBLE_SIZE - 6) / 2,
    borderWidth: 2,
  },
  ringFill: {
    position: 'absolute',
    width: BUBBLE_SIZE - 6,
    height: BUBBLE_SIZE - 6,
    borderRadius: (BUBBLE_SIZE - 6) / 2,
    borderWidth: 2,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
  },
  playDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
