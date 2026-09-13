import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { authColors, authLayout } from './authStyles';
import Icon from '../Icon';

export function AuthErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.err}>
      <Text style={styles.errText}>
        <Icon name="exclamation-triangle" size={11} color={authColors.red} />{'  '}{message}
      </Text>
    </View>
  );
}

export function AuthOkBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.ok}>
      <Text style={styles.okText}>
        <Icon name="check-circle" size={11} color={authColors.green} />{'  '}{message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  err: {
    backgroundColor: 'rgba(247,129,102,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(247,129,102,0.35)',
    borderRadius: authLayout.errBoxRadius,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  errText: { color: authColors.red, fontSize: authLayout.errBoxFontSize },
  ok: {
    backgroundColor: 'rgba(63,185,80,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(63,185,80,0.35)',
    borderRadius: authLayout.errBoxRadius,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  okText: { color: authColors.green, fontSize: authLayout.errBoxFontSize },
});
