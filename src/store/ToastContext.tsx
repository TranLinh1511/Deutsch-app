import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobile } from '@/theme/theme';
import Icon, { IconProps } from '@/components/Icon';

/** index.html: showToast(msg) / #toast — centered bottom banner, `transition: opacity 0.3s`, auto-hides */
interface ToastContextValue {
  /** icon: tên icon Font Awesome hiển thị trước nội dung toast (tuỳ chọn). */
  showToast: (message: string, icon?: IconProps['name']) => void;
}
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [icon, setIcon] = useState<IconProps['name'] | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const showToast = useCallback(
    (msg: string, ic?: IconProps['name']) => {
      setMessage(msg);
      setIcon(ic);
      if (timerRef.current) clearTimeout(timerRef.current);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      timerRef.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setMessage(null));
      }, 2200);
    },
    [opacity]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message ? (
        <View
          style={[styles.wrap, { bottom: 28 + insets.bottom }]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.toast, { opacity }]}>
            {icon ? <Icon name={icon} size={13} color="#fff" style={styles.icon} /> : null}
            <Text style={styles.text}>{message}</Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,24,0.92)',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    maxWidth: `${mobile.toastMaxWidthPercent * 100}%`,
  },
  icon: { marginRight: 8 },
  text: { color: '#fff', fontSize: mobile.toastFontSize, textAlign: 'center' },
});
