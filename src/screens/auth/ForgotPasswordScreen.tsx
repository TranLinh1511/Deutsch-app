import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/theme/ThemeContext';
import { sendResetEmail, AuthFieldError } from '@/services/firebase/auth';
import AuthCard from '@/components/auth/AuthCard';
import AuthField from '@/components/auth/AuthField';
import AuthButton from '@/components/auth/AuthButton';
import { AuthErrorBox, AuthOkBox } from '@/components/auth/AuthMessageBox';
import Icon from '@/components/Icon';
import type { AuthStackParamList } from '@/navigation/AuthStack';

/**
 * Rebuild of Login.html's #forgotView / doFindUser().
 * NOTE ON FIDELITY: Login.html's markup includes a "forgotStep2" UI (nhập
 * mật khẩu mới) but it is never wired to any working logic in the original
 * script — doFindUser() only ever calls sendPasswordResetEmail() and shows
 * an inline success message, staying on step 1. We rebuild the REAL
 * (functional) behavior, not the dead markup, per the source-of-truth rule
 * in the prompt.
 */
export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<'default' | 'err' | 'ok'>('default');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function doFindUser() {
    setErrMsg(null);
    setOkMsg(null);
    setStatus('default');

    if (!username.trim()) {
      setStatus('err');
      setErrMsg('Vui lòng nhập tên đăng nhập');
      return;
    }

    setIsLoading(true);
    try {
      await sendResetEmail(username);
      setStatus('ok');
      setOkMsg('Đã gửi email đặt lại mật khẩu!');
    } catch (e) {
      setStatus('err');
      setErrMsg(e instanceof AuthFieldError ? e.message : 'Không tìm thấy tài khoản này');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
        <AuthCard>
          <Pressable style={styles.backRow} onPress={() => navigation.goBack()}>
            <Text style={{ color: colors.tx2, fontSize: 12.8 }}>
              <Icon name="arrow-left" size={11} color={colors.tx2} />{'  '}Quay lại đăng nhập
            </Text>
          </Pressable>

          <AuthErrorBox message={errMsg} />
          <AuthOkBox message={okMsg} />

          <AuthField
            label="Tên đăng nhập"
            placeholder="Nhập tên đăng nhập..."
            autoCapitalize="none"
            value={username}
            status={status === 'default' ? undefined : status}
            onChangeText={(t) => {
              setUsername(t);
              setStatus('default');
              setErrMsg(null);
            }}
            onSubmitEditing={doFindUser}
          />

          <AuthButton
            label="Tìm tài khoản"
            icon="arrow-right"
            iconPosition="trailing"
            loadingLabel="Đang tìm..."
            isLoading={isLoading}
            onPress={doFindUser}
            variant="gold"
          />
        </AuthCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  backRow: { marginBottom: 14 },
});
