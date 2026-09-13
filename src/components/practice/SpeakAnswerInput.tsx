import React, { useEffect } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { mobile, fonts } from '@/theme/theme';
import Icon from '@/components/Icon';
import { useSpeechRecognizer, type SpeechLang } from '@/hooks/useSpeechRecognizer';
import { useToast } from '@/store/ToastContext';

interface SpeakAnswerInputProps {
  /** Chữ nhận diện được từ lần nói gần nhất — hiển thị lại để người dùng
   * biết máy đã nghe được gì (không phải ô nhập, chỉ để xem). */
  value: string;
  status: 'idle' | 'correct' | 'wrong';
  /** Gọi khi nhận diện xong 1 lượt nói — engine tự so khớp đúng/sai. */
  onResult: (transcript: string) => void;
  /** Ngôn ngữ cần nhận diện: 'de-DE' khi đích là tiếng Đức (nguyên từ/câu ví
   * dụ), 'vi-VN' khi đích là nghĩa tiếng Việt. */
  lang: SpeechLang;
  placeholder: string;
  /** Đổi mỗi khi sang câu khác — dùng để huỷ lượt ghi âm đang dở, tránh kết
   * quả nhận diện của từ CŨ lạc sang câu MỚI. */
  questionKey?: string;
}

const STATUS_TO_NUM = { idle: 0, correct: 1, wrong: 2 } as const;

/**
 * Chế độ luyện "Phát âm" (song song với Viết/Chọn/Nghe): thay vì gõ chữ,
 * người dùng bấm mic và ĐỌC to từ/câu cần trả lời. expo-speech-recognition
 * nhận diện NGAY TRÊN THIẾT BỊ (không qua cloud), trả lại text, rồi engine
 * so khớp y hệt logic chấm của chế độ Viết (checkWriteAnswer/isMeaningMatch/
 * isSentenceMatch) — chỉ xác nhận "nói đúng từ chưa", KHÔNG chấm điểm phát
 * âm chi tiết theo từng âm.
 */
export default function SpeakAnswerInput({ value, status, onResult, lang, placeholder, questionKey }: SpeakAnswerInputProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const anim = React.useRef(new Animated.Value(STATUS_TO_NUM.idle)).current;

  const { status: recStatus, start, stop } = useSpeechRecognizer({
    onResult,
    onError: (msg) => showToast(msg, 'exclamation-circle'),
  });
  const listening = recStatus === 'listening';

  useEffect(() => {
    Animated.timing(anim, {
      toValue: STATUS_TO_NUM[status],
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [status, anim]);

  // Sang câu khác trong lúc còn đang ghi âm dở — huỷ ngay, không để kết quả
  // trả về muộn bị gán nhầm cho câu mới.
  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey]);

  const borderColor = anim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [colors.inputBorder, '#3fb950', '#f78166'],
  });

  return (
    <Animated.View style={{ marginTop: 12 }}>
      <Pressable onPress={() => (listening ? stop() : start(lang))}>
        <Animated.View
          style={[styles.box, { backgroundColor: colors.inputBg, borderColor: borderColor as unknown as string }]}
        >
          <View style={[styles.micCircle, { backgroundColor: listening ? 'rgba(247,129,102,0.15)' : 'rgba(88,166,255,0.12)' }]}>
            <Icon name="microphone" size={16} color={listening ? '#f78166' : '#58a6ff'} />
          </View>
          <Text
            style={{ color: value ? colors.inputColor : colors.tx3, fontSize: mobile.answerInputSize, fontFamily: fonts.mono, flex: 1 }}
            numberOfLines={1}
          >
            {listening ? 'Đang nghe…' : value || placeholder}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    borderWidth: 2,
    borderRadius: 10,
    padding: mobile.answerInputPadding,
  },
  micCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
