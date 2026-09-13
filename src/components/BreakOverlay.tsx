import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import Icon from './Icon';

interface BreakOverlayProps {
  visible: boolean;
  formattedTime: string;
}

/**
 * index.html: #breakOverlay — on mobile the cat-video slide-in is
 * intentionally skipped by the original itself (isMobileBreak branch),
 * leaving just a full-screen overlay + countdown. No dismiss button by
 * design: the original doesn't let you skip a break early either.
 */
export default function BreakOverlay({ visible, formattedTime }: BreakOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <Icon name="bed" size={56} color="#58a6ff" style={styles.emoji} />
        <Text style={styles.title}>Nghỉ giải lao</Text>
        <Text style={styles.subtitle}>Đứng dậy vươn vai một chút nhé!</Text>
        <Text style={styles.countdown}>{formattedTime}</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13,17,23,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { color: '#e6edf3', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#8b949e', fontSize: 14, marginBottom: 28 },
  countdown: { color: '#58a6ff', fontSize: 44, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
