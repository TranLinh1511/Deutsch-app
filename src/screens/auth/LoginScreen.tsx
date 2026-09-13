import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/theme/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { login, AuthFieldError } from '@/services/firebase/auth';
import AuthCard from '@/components/auth/AuthCard';
import AuthField from '@/components/auth/AuthField';
import AuthButton from '@/components/auth/AuthButton';
import { AuthErrorBox } from '@/components/auth/AuthMessageBox';
import Icon from '@/components/Icon';
import type { AuthStackParamList } from '@/navigation/AuthStack';

/**
 * Full rebuild of Login.html's #formView + doLogin().
 * Field-level red border on error / green on success, exactly like
 * .field input.err / .field input.ok in the original CSS.
 */
export default function LoginScreen() {
  const { colors } = useTheme();
  const { setSessionUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState<{ username?: 'err' | 'ok'; password?: 'err' | 'ok' }>({});
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function clearFieldError() {
    setStatus({});
    setErrMsg(null);
  }

  async function doLogin() {
    setErrMsg(null);
    setStatus({});

    if (!username.trim()) {
      setStatus({ username: 'err' });
      return;
    }
    if (!password) {
      setStatus({ password: 'err' });
      return;
    }

    setIsLoading(true);
    try {
      const { uid, displayName } = await login(username, password);
      setStatus({ username: 'ok', password: 'ok' });
      setSuccess(true);
      // Matches original's setTimeout(600) "✓ Thành công!" pause before navigating
      setTimeout(() => {
        setSessionUser({ uid, displayName }, remember);
      }, 600);
    } catch (e) {
      setIsLoading(false);
      if (e instanceof AuthFieldError) {
        setStatus({ [e.field]: 'err' } as any);
        setErrMsg(e.message);
      } else {
        setStatus({ username: 'err', password: 'err' });
        setErrMsg('Sai tên đăng nhập hoặc mật khẩu');
      }
      setPassword('');
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
        <AuthCard>
          {success ? (
            <View style={styles.successBox}>
              <Icon name="check-circle" size={40} color="#3fb950" style={styles.successIcon} />
              <Text style={[styles.successMsg, { color: colors.tx }]}>Đăng nhập thành công!</Text>
              <Text style={{ color: colors.tx3, fontSize: 12.8, marginTop: 4 }}>
                Đang chuyển hướng vào app...
              </Text>
            </View>
          ) : (
            <>
              <AuthErrorBox message={errMsg} />

              <AuthField
                label="Tên đăng nhập"
                placeholder="Nhập tên đăng nhập..."
                autoCapitalize="none"
                value={username}
                status={status.username}
                onChangeText={(t) => {
                  setUsername(t);
                  clearFieldError();
                }}
                onSubmitEditing={doLogin}
              />
              <AuthField
                label="Mật khẩu"
                placeholder="••••••••"
                isPassword
                value={password}
                status={status.password}
                onChangeText={(t) => {
                  setPassword(t);
                  clearFieldError();
                }}
                onSubmitEditing={doLogin}
              />

              <View style={styles.rememberRow}>
                <Pressable style={styles.rememberLabel} onPress={() => setRemember((r) => !r)}>
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: colors.border, backgroundColor: remember ? '#58a6ff' : 'transparent' },
                    ]}
                  >
                    {remember && <Icon name="check" size={10} color="#fff" />}
                  </View>
                  <Text style={{ color: colors.tx2, fontSize: 12.48 }}>Ghi nhớ đăng nhập</Text>
                </Pressable>
                <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
                  <Text style={{ color: colors.tx3, fontSize: 11.84 }}>Quên mật khẩu?</Text>
                </Pressable>
              </View>

              <AuthButton
                label="Đăng nhập"
                icon="arrow-right"
                iconPosition="trailing"
                loadingLabel="Đang kiểm tra..."
                isLoading={isLoading}
                onPress={doLogin}
              />

              <View style={[styles.orRow]}>
                <View style={[styles.orLine, { backgroundColor: colors.border2 }]} />
                <Text style={{ color: colors.tx3, fontSize: 11.52 }}>hoặc</Text>
                <View style={[styles.orLine, { backgroundColor: colors.border2 }]} />
              </View>

              <View style={styles.newUserRow}>
                <Text style={{ color: colors.tx3, fontSize: 12.48 }}>Chưa có tài khoản? </Text>
                <Pressable onPress={() => navigation.navigate('Register')}>
                  <Text style={{ color: '#58a6ff', fontWeight: '700', fontSize: 12.48 }}>Đăng ký ngay</Text>
                </Pressable>
              </View>
            </>
          )}
        </AuthCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  rememberLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  checkbox: {
    width: 15,
    height: 15,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 10, fontWeight: '700' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  orLine: { flex: 1, height: 1 },
  newUserRow: { flexDirection: 'row', justifyContent: 'center' },
  successBox: { alignItems: 'center', paddingVertical: 16 },
  successIcon: { fontSize: 41.6, marginBottom: 10 },
  successMsg: { fontWeight: '700', fontSize: 15.2 },
});
