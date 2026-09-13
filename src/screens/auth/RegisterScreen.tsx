import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/theme/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { register, AuthFieldError } from '@/services/firebase/auth';
import AuthCard from '@/components/auth/AuthCard';
import AuthField from '@/components/auth/AuthField';
import AuthButton from '@/components/auth/AuthButton';
import { AuthErrorBox } from '@/components/auth/AuthMessageBox';
import Icon from '@/components/Icon';
import type { AuthStackParamList } from '@/navigation/AuthStack';

type FieldKey = 'name' | 'username' | 'password' | 'confirm';

/** Full rebuild of Login.html's #registerView + doRegister(), same validate order. */
export default function RegisterScreen() {
  const { colors } = useTheme();
  const { setSessionUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<Partial<Record<FieldKey, 'err' | 'ok'>>>({});
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function clear() {
    setStatus({});
    setErrMsg(null);
  }

  async function doRegister() {
    setErrMsg(null);
    setStatus({});
    setIsLoading(true);
    try {
      const { uid, displayName } = await register(name, username, password, confirm);
      setStatus({ name: 'ok', username: 'ok', password: 'ok', confirm: 'ok' });
      setSuccess(true);
      // Mirrors original: success view (2000ms) then drop straight into the app,
      // same as the original's setTimeout that pre-fills the login username.
      setTimeout(() => {
        setSessionUser({ uid, displayName }, true);
      }, 800);
    } catch (e) {
      setIsLoading(false);
      if (e instanceof AuthFieldError) {
        setStatus({ [e.field]: 'err' } as any);
        setErrMsg(e.message);
      } else {
        setErrMsg('Đã có lỗi xảy ra, vui lòng thử lại');
      }
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
              <Icon name="trophy" size={40} color="#3fb950" style={styles.successIcon} />
              <Text style={[styles.successMsg, { color: colors.tx }]}>Đăng ký thành công!</Text>
              <Text style={{ color: colors.tx3, fontSize: 12.8, marginTop: 4 }}>
                Chào mừng bạn đến với bei TL!
              </Text>
            </View>
          ) : (
            <>
              <AuthErrorBox message={errMsg} />

              <AuthField
                label="Họ và tên"
                placeholder="Nguyễn Văn A..."
                value={name}
                status={status.name}
                onChangeText={(t) => {
                  setName(t);
                  clear();
                }}
              />
              <AuthField
                label="Tên đăng nhập"
                placeholder="Nhập tên đăng nhập..."
                autoCapitalize="none"
                value={username}
                status={status.username}
                onChangeText={(t) => {
                  setUsername(t);
                  clear();
                }}
              />
              <AuthField
                label="Mật khẩu"
                placeholder="Tối thiểu 6 ký tự"
                isPassword
                value={password}
                status={status.password}
                onChangeText={(t) => {
                  setPassword(t);
                  clear();
                }}
              />
              <AuthField
                label="Xác nhận mật khẩu"
                placeholder="Nhập lại mật khẩu"
                isPassword
                value={confirm}
                status={status.confirm}
                onChangeText={(t) => {
                  setConfirm(t);
                  clear();
                }}
                onSubmitEditing={doRegister}
              />

              <AuthButton
                label="Tạo tài khoản"
                icon="arrow-right"
                iconPosition="trailing"
                loadingLabel="Đang tạo tài khoản..."
                isLoading={isLoading}
                onPress={doRegister}
                variant="green"
              />

              <View style={styles.orRow}>
                <View style={[styles.orLine, { backgroundColor: colors.border2 }]} />
                <Text style={{ color: colors.tx3, fontSize: 11.52 }}>hoặc</Text>
                <View style={[styles.orLine, { backgroundColor: colors.border2 }]} />
              </View>

              <View style={styles.newUserRow}>
                <Text style={{ color: colors.tx3, fontSize: 12.48 }}>Đã có tài khoản? </Text>
                <Pressable onPress={() => navigation.navigate('Login')}>
                  <Text style={{ color: '#58a6ff', fontWeight: '700', fontSize: 12.48 }}>Đăng nhập</Text>
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
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  orLine: { flex: 1, height: 1 },
  newUserRow: { flexDirection: 'row', justifyContent: 'center' },
  successBox: { alignItems: 'center', paddingVertical: 16 },
  successIcon: { fontSize: 41.6, marginBottom: 10 },
  successMsg: { fontWeight: '700', fontSize: 15.2 },
});
