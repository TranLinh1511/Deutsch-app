import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { authColors, authLayout, fonts } from './authStyles';

export default function AuthCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
        <View style={styles.deco}>
          <View style={[styles.dot, { backgroundColor: 'rgba(247,129,102,0.7)' }]} />
          <View style={[styles.dot, { backgroundColor: 'rgba(240,192,0,0.7)' }]} />
          <View style={[styles.dot, { backgroundColor: 'rgba(63,185,80,0.7)' }]} />
        </View>

        <View style={styles.logoRow}>
          <Text style={styles.flag}>🇩🇪</Text>
          <View>
            <Text style={[styles.brand, { color: colors.tx }]}>
              bei <Text style={{ color: authColors.blue }}>TL</Text>
            </Text>
            <Text style={[styles.tagline, { color: colors.tx3 }]}>Học tiếng Đức mỗi ngày</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border2 }]} />

        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 420, padding: 16, alignSelf: 'center' },
  card: {
    borderRadius: authLayout.cardRadius,
    borderWidth: 1,
    paddingTop: authLayout.cardPaddingTop,
    paddingHorizontal: authLayout.cardPaddingH,
    paddingBottom: authLayout.cardPaddingBottom,
  },
  deco: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 26 },
  flag: { fontSize: authLayout.flagFontSize, lineHeight: authLayout.flagFontSize },
  brand: { fontWeight: '800', fontSize: authLayout.brandFontSize, letterSpacing: -0.4, fontFamily: fonts.brand },
  tagline: { fontSize: authLayout.taglineFontSize, marginTop: 2 },
  divider: { height: 1, marginBottom: 24 },
});
