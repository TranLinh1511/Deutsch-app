import React, { useEffect, useRef } from 'react';
import { TextInput, Animated, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { mobile, fonts } from '@/theme/theme';
import { useAnswerValue, type AnswerStore } from '@/hooks/answerStore';

interface ExerciseAnswerInputProps {
  /** Store chứa chữ đang gõ — CHỈ component này đăng ký theo dõi, nên gõ phím
   * không làm MainScreen (hay bất kỳ component cha nào) render lại. */
  store: AnswerStore;
  status: 'idle' | 'correct' | 'wrong';
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  placeholder: string;
  /** Đổi mỗi khi sang câu khác (vd. currentQuestion.id) — dùng để tự focus
   * lại ô nhập, để chuyển câu không làm mất focus/đóng bàn phím. */
  questionKey?: string;
}

const STATUS_TO_NUM = { idle: 0, correct: 1, wrong: 2 } as const;

/**
 * index.html: #dynamicAnswerInput — .correct-border (green) / .wrong-border
 * (red), `transition: border-color 0.3s`.
 *
 * TỐI ƯU GÕ MƯỢT (so với bản cũ):
 *  1) Chữ đang gõ đọc từ `store` (useSyncExternalStore) thay vì prop từ
 *     MainScreen → mỗi phím chỉ render lại đúng ô nhập này.
 *  2) Viền động chuyển sang Animated.View BAO NGOÀI, ô TextInput bên trong
 *     là TextInput thường. Trước đây TextInput là Animated component bị
 *     JS-driver gọi setNativeProps mỗi khung hình khi đổi viền — dễ gây
 *     chớp/đứng chữ trên iOS ngay lúc đang gõ (nhất là khi gõ xong từ đúng).
 *  3) Giữ nguyên cơ chế giữ focus khi chuyển câu (blurOnSubmit=false,
 *     focus() lại khi questionKey đổi nếu trước đó đang focus).
 */
function ExerciseAnswerInput({
  store,
  status,
  onChangeText,
  onSubmit,
  placeholder,
  questionKey,
}: ExerciseAnswerInputProps) {
  const { colors, mode } = useTheme();
  const value = useAnswerValue(store);
  const anim = useRef(new Animated.Value(STATUS_TO_NUM.idle)).current;
  const inputRef = useRef<TextInput>(null);
  const wasFocusedRef = useRef(false);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: STATUS_TO_NUM[status],
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [status, anim]);

  useEffect(() => {
    if (wasFocusedRef.current) {
      inputRef.current?.focus();
    }
    // Chỉ chạy lại khi thật sự sang câu khác.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey]);

  const borderColor = anim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [colors.inputBorder, '#3fb950', '#f78166'],
  });

  return (
    <Animated.View
      style={[
        styles.frame,
        { backgroundColor: colors.inputBg, borderColor: borderColor as unknown as string },
      ]}
    >
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        blurOnSubmit={false}
        onFocus={() => {
          wasFocusedRef.current = true;
        }}
        onBlur={() => {
          wasFocusedRef.current = false;
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.tx3}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        textContentType="none"
        keyboardAppearance={mode === 'light' ? 'light' : 'dark'}
        style={[styles.input, { color: colors.inputColor }]}
      />
    </Animated.View>
  );
}

export default React.memo(ExerciseAnswerInput);

const styles = StyleSheet.create({
  frame: {
    marginTop: 12,
    width: '100%',
    borderWidth: 2,
    borderRadius: 10,
  },
  input: {
    width: '100%',
    fontSize: mobile.answerInputSize,
    padding: mobile.answerInputPadding,
    fontFamily: fonts.mono,
  },
});
