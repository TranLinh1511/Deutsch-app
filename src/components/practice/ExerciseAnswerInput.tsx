import React, { useEffect, useRef } from 'react';
import { TextInput, Animated, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { mobile, fonts } from '@/theme/theme';

interface ExerciseAnswerInputProps {
  value: string;
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
 * (red), `transition: border-color 0.3s cubic-bezier(0.4,0,0.2,1)`.
 * Animated.Value + color interpolation ports that smooth transition
 * instead of an instant color swap.
 *
 * GIỮ FOCUS KHI CHUYỂN CÂU: trước đây khi hoàn thành câu (bấm Enter/nút
 * "chuyển câu tiếp theo"), bàn phím tự đóng — do (1) TextInput mặc định
 * `blurOnSubmit` = true nên bấm Enter tự blur, và (2) chạm vào nút ⏭ nằm
 * ngoài ô nhập cũng tự blur ô đang focus (hành vi mặc định của RN/hệ điều
 * hành). Sửa bằng cách: tắt blurOnSubmit, tự theo dõi focus hiện tại qua
 * ref, và mỗi khi câu hỏi đổi (questionKey đổi) — NẾU trước đó ô đang được
 * focus — tự gọi lại focus() để bàn phím không bị đóng giữa hai câu.
 */
export default function ExerciseAnswerInput({
  value,
  status,
  onChangeText,
  onSubmit,
  placeholder,
  questionKey,
}: ExerciseAnswerInputProps) {
  const { colors } = useTheme();
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
    <Animated.View style={{ marginTop: 12 }}>
      <AnimatedTextInput
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
        style={[
          styles.input,
          { color: colors.inputColor, backgroundColor: colors.inputBg, borderColor: borderColor as unknown as string },
        ]}
      />
    </Animated.View>
  );
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const styles = StyleSheet.create({
  input: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 10,
    fontSize: mobile.answerInputSize,
    padding: mobile.answerInputPadding,
    fontFamily: fonts.mono,
  },
});
