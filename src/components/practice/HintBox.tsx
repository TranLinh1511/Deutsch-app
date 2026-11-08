import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { useAnswerValue, type AnswerStore } from '@/hooks/answerStore';
import { buildHintContent } from '@/utils/hint';
import type { Question, ExerciseMode, ExerciseType } from '@/utils/questionBuilder';

interface HintBoxProps {
  question: Question;
  effectiveType: Exclude<ExerciseType, 'mixedRandom'>;
  exerciseMode: ExerciseMode;
  store: AnswerStore;
}

/**
 * Khối "Gợi ý" tách riêng khỏi MainScreen: nó cần chữ đang gõ để tô đúng/sai
 * từng ký tự, nên TỰ đăng ký theo dõi answerStore. Nhờ vậy khi gợi ý đang mở,
 * mỗi phím chỉ render lại khối nhỏ này chứ không kéo cả màn hình theo.
 */
function HintBox({ question, effectiveType, exerciseMode, store }: HintBoxProps) {
  const { colors } = useTheme();
  const typed = useAnswerValue(store);
  const content = useMemo(
    () => buildHintContent(question, effectiveType, exerciseMode, typed),
    [question, effectiveType, exerciseMode, typed]
  );

  return (
    <View style={[styles.box, { backgroundColor: 'rgba(210,168,255,0.07)', borderColor: 'rgba(210,168,255,0.2)' }]}>
      {content.kind === 'text' ? (
        <Text style={{ color: '#d2a8ff', fontSize: 14.4, fontFamily: 'DM Mono' }}>{content.text}</Text>
      ) : (
        <Text style={{ fontSize: 14.4, fontFamily: 'DM Mono' }}>
          {content.chars.map((c, i) => (
            <Text
              key={i}
              style={{
                color: c.state === 'bad' ? '#f78166' : c.state === 'ok' ? colors.tx : '#d2a8ff',
                textDecorationLine: c.state === 'bad' ? 'underline' : 'none',
              }}
            >
              {c.ch}
            </Text>
          ))}
        </Text>
      )}
    </View>
  );
}

export default React.memo(HintBox);

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 10 },
});
