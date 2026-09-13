import React from 'react';
import { Pressable, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { authColors, authLayout } from './authStyles';
import Icon, { IconProps } from '../Icon';

interface AuthButtonProps {
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** .btn-submit background: var(--blue) default, .green for register, gold for forgot/reset */
  variant?: 'blue' | 'green' | 'gold';
  /** Icon Font Awesome hiển thị trước/sau label (tuỳ chọn). */
  icon?: IconProps['name'];
  iconPosition?: 'leading' | 'trailing';
}

export default function AuthButton({
  label,
  loadingLabel,
  isLoading,
  disabled,
  onPress,
  variant = 'blue',
  icon,
  iconPosition = 'leading',
}: AuthButtonProps) {
  const bg = authColors[variant];
  const textColor = variant === 'gold' ? '#0d1117' : '#fff';
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.inner}>
        {isLoading && <ActivityIndicator size="small" color={textColor} />}
        {!isLoading && icon && iconPosition === 'leading' && <Icon name={icon} size={13} color={textColor} />}
        <Text style={[styles.text, { color: textColor }]}>
          {isLoading && loadingLabel ? loadingLabel : label}
        </Text>
        {!isLoading && icon && iconPosition === 'trailing' && <Icon name={icon} size={13} color={textColor} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    borderRadius: authLayout.buttonRadius,
    paddingVertical: authLayout.buttonPaddingV,
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { fontWeight: '700', fontSize: 15.2, letterSpacing: 0.2 }, // Syne 700, 0.95rem
});
