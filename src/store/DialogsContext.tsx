import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import BottomSheetModal from '@/components/BottomSheetModal';
import AuthButton from '@/components/auth/AuthButton';

/**
 * Promise-based replacement for the original's browser confirm()/prompt()
 * overrides (customConfirm, customPrompt, _ensureCustomPromptModal in
 * index.html). Presented as bottom-sheets per prompt 1.1 (every modal on
 * mobile trồi lên từ dưới), not native Alert, so styling/behavior matches
 * the rest of the app.
 *
 * Usage: const { customConfirm, customPrompt } = useDialogs();
 *        if (await customConfirm('Bạn có chắc muốn xoá?')) { ... }
 *        const name = await customPrompt('Tên phiên mới:');
 */
interface DialogsContextValue {
  customConfirm: (message: string) => Promise<boolean>;
  customPrompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

const DialogsContext = createContext<DialogsContextValue | null>(null);

type PendingConfirm = { message: string; resolve: (v: boolean) => void } | null;
type PendingPrompt = { message: string; defaultValue: string; resolve: (v: string | null) => void } | null;

export function DialogsProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt>(null);
  const [promptValue, setPromptValue] = useState('');

  const customConfirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirm({ message, resolve });
    });
  }, []);

  const customPrompt = useCallback((message: string, defaultValue = '') => {
    setPromptValue(defaultValue);
    return new Promise<string | null>((resolve) => {
      setPendingPrompt({ message, defaultValue, resolve });
    });
  }, []);

  const closeConfirm = (result: boolean) => {
    pendingConfirm?.resolve(result);
    setPendingConfirm(null);
  };
  const closePrompt = (result: string | null) => {
    pendingPrompt?.resolve(result);
    setPendingPrompt(null);
  };

  return (
    <DialogsContext.Provider value={{ customConfirm, customPrompt }}>
      {children}

      <BottomSheetModal visible={!!pendingConfirm} onClose={() => closeConfirm(false)}>
        <Text style={[styles.message, { color: colors.tx }]}>{pendingConfirm?.message}</Text>
        <View style={styles.row}>
          <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => closeConfirm(false)}>
            <Text style={{ color: colors.tx2 }}>Huỷ</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <AuthButton label="Đồng ý" onPress={() => closeConfirm(true)} variant="blue" />
          </View>
        </View>
      </BottomSheetModal>

      <BottomSheetModal visible={!!pendingPrompt} onClose={() => closePrompt(null)}>
        <Text style={[styles.message, { color: colors.tx }]}>{pendingPrompt?.message}</Text>
        <TextInput
          autoFocus
          value={promptValue}
          onChangeText={setPromptValue}
          style={[styles.input, { color: colors.tx, backgroundColor: colors.bg3, borderColor: colors.border }]}
          placeholderTextColor={colors.tx3}
        />
        <View style={styles.row}>
          <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => closePrompt(null)}>
            <Text style={{ color: colors.tx2 }}>Huỷ</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <AuthButton label="OK" onPress={() => closePrompt(promptValue)} variant="blue" />
          </View>
        </View>
      </BottomSheetModal>
    </DialogsContext.Provider>
  );
}

export function useDialogs() {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('useDialogs must be used within DialogsProvider');
  return ctx;
}

const styles = StyleSheet.create({
  message: { fontSize: 15, marginBottom: 14, fontWeight: '600' },
  input: { borderWidth: 1.5, borderRadius: 9, padding: 12, fontSize: 15, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  cancelBtn: {
    paddingHorizontal: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
