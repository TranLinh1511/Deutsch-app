import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { authColors, fonts } from './authStyles';
import Icon from '../Icon';

interface AuthFieldProps extends TextInputProps {
  label: string;
  status?: 'default' | 'err' | 'ok';
  isPassword?: boolean;
}

/**
 * Maps Login.html .field:
 *  - label: uppercase, 0.72rem, bold, tx3, letter-spacing 0.08em
 *  - input: bg3, border 1.5px border, radius 9, font DM Mono 0.95rem, padding 11 14
 *  - .err  -> border red (--red #f78166), bg rgba(247,129,102,.05)
 *  - .ok   -> border green (--green #3fb950)
 *  - password fields get an 👁/🙈 toggle button (.pw-toggle)
 */
export default function AuthField({ label, status = 'default', isPassword, ...inputProps }: AuthFieldProps) {
  const { colors } = useTheme();
  const [secure, setSecure] = useState(!!isPassword);

  const borderColor =
    status === 'err' ? authColors.red : status === 'ok' ? authColors.green : colors.border;
  const backgroundColor = status === 'err' ? 'rgba(247,129,102,0.05)' : colors.bg3;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.tx3 }]}>{label}</Text>
      <View style={styles.pwWrap}>
        <TextInput
          {...inputProps}
          secureTextEntry={secure}
          placeholderTextColor={colors.tx3}
          style={[
            styles.input,
            {
              color: colors.tx,
              backgroundColor,
              borderColor,
              paddingRight: isPassword ? 46 : 14,
            },
            inputProps.style,
          ]}
        />
        {isPassword && (
          <Pressable style={styles.pwToggle} onPress={() => setSecure((s) => !s)} hitSlop={8}>
            <Icon name={secure ? 'eye' : 'eye-slash'} size={14} color={colors.tx3} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 15 },
  label: {
    fontSize: 11.52, // 0.72rem
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 7,
  },
  pwWrap: { position: 'relative', justifyContent: 'center' },
  input: {
    width: '100%',
    borderWidth: 1.5,
    fontFamily: fonts.mono,
    fontSize: 15.2, // 0.95rem
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 9,
  },
  pwToggle: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
});
