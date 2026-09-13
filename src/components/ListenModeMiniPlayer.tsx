import React, { useRef } from 'react';
import { Animated, PanResponder, Dimensions, StyleSheet, Text, Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { accent } from '@/theme/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BAR_W = 176;
const BAR_H = 50;
const DOCK_OPACITY = 0.55; // "ẩn nhẹ" — mờ bớt khi neo vào cạnh màn hình
const DRAG_OPACITY = 1;
const TAP_MOVE_THRESHOLD = 6;

interface Props {
  visible: boolean;
  isPlaying: boolean;
  wordIndex: number;
  total: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onExpand: () => void;
  onClose: () => void;
}

/**
 * Icon nhạc nổi (floating mini-player) cho "Nghe từ vựng" khi thu nhỏ modal
 * — vẫn phát tiếp dưới nền. Kéo tự do quanh màn hình; khi thả ra sẽ tự neo
 * (snap) vào cạnh trái/phải gần nhất và mờ bớt đi (ẩn nhẹ) như chat-head,
 * chạm nhẹ (không kéo) sẽ mở lại modal đầy đủ.
 */
export default function ListenModeMiniPlayer({
  visible,
  isPlaying,
  wordIndex,
  total,
  onTogglePlay,
  onNext,
  onExpand,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const pan = useRef(new Animated.ValueXY({ x: SCREEN_W - BAR_W - 14, y: SCREEN_H - 220 })).current;
  const opacity = useRef(new Animated.Value(DOCK_OPACITY)).current;
  const dragged = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > TAP_MOVE_THRESHOLD || Math.abs(g.dy) > TAP_MOVE_THRESHOLD,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > TAP_MOVE_THRESHOLD || Math.abs(g.dy) > TAP_MOVE_THRESHOLD,
      onPanResponderGrant: () => {
        dragged.current = true;
        // @ts-ignore — Animated.ValueXY exposes _value at runtime
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
        Animated.timing(opacity, { toValue: DRAG_OPACITY, duration: 120, useNativeDriver: false }).start();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        // @ts-ignore
        const currentX: number = pan.x._value;
        // @ts-ignore
        const currentY: number = pan.y._value;
        const clampedY = Math.max(30, Math.min(SCREEN_H - BAR_H - 30, currentY));
        const snapLeft = currentX + BAR_W / 2 < SCREEN_W / 2;
        const targetX = snapLeft ? -BAR_W * 0.5 : SCREEN_W - BAR_W * 0.5;
        Animated.parallel([
          Animated.spring(pan, { toValue: { x: targetX, y: clampedY }, useNativeDriver: false, friction: 8 }),
          Animated.timing(opacity, { toValue: DOCK_OPACITY, duration: 220, useNativeDriver: false }),
        ]).start();
        dragged.current = false;
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.bar,
        {
          backgroundColor: colors.bg2,
          borderColor: colors.border,
          opacity,
          transform: pan.getTranslateTransform(),
        },
      ]}
    >
      <Pressable onPress={onTogglePlay} hitSlop={8} style={[styles.iconBtn, { backgroundColor: accent.blue }]}>
        <Text style={{ color: '#fff', fontSize: 15 }}>{isPlaying ? '⏸' : '▶'}</Text>
      </Pressable>
      <Pressable onPress={onExpand} hitSlop={4} style={styles.infoArea}>
        <Text numberOfLines={1} style={{ color: colors.tx, fontSize: 11, fontWeight: '700' }}>
          🎧 {wordIndex + 1}/{total}
        </Text>
        <Text style={{ color: colors.tx3, fontSize: 9.5 }}>Chạm để mở</Text>
      </Pressable>
      <Pressable onPress={onNext} hitSlop={8} style={styles.smallBtn}>
        <Text style={{ color: colors.tx2, fontSize: 14 }}>⏭</Text>
      </Pressable>
      <Pressable onPress={onClose} hitSlop={8} style={styles.smallBtn}>
        <Text style={{ color: colors.tx2, fontSize: 12 }}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BAR_W,
    height: BAR_H,
    borderRadius: BAR_H / 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 999,
  },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  infoArea: { flex: 1, paddingHorizontal: 8, justifyContent: 'center' },
  smallBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
});
