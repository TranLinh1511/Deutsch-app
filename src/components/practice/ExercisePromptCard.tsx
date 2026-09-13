import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeContext';
import { mobile } from '@/theme/theme';
import type { Question, ExerciseMode } from '@/utils/questionBuilder';
import { getVietnameseExample } from '@/utils/grading';
import { useToast } from '@/store/ToastContext';
import Icon, { IconProps } from '@/components/Icon';

/**
 * index.html: .ex-prompt + _getPromptStateClass(q) — priority order matters:
 * flagged > mastered > correct > normal. Requires `expo-linear-gradient`
 * (add to package.json) since RN Views can't gradient natively.
 */
interface ExercisePromptCardProps {
  question: Question;
  typeTag: string;
  promptMainText: string;
  exerciseMode: ExerciseMode;
  onPlayAudio?: () => void;
  // Item 7: chạm vào thẻ câu hỏi (bất kể đang ở chế độ nào) sẽ luôn phát âm
  // nguyên từ tiếng Đức của từ đang luyện.
  onPlayWord?: () => void;
  progressPct: number;
  index: number;
  total: number;
  sourceLabel: string;
  onToggleMastered: () => void;
  // index.html: wtBadge — purple word-type pill next to the question
  wordType?: string;
  // index.html: settingsBarHtml — 5 quick-toggle icons inline with the counter
  quickToggles: {
    randomMode: boolean;
    onToggleRandom: () => void;
    autoAdvanceOnCorrect: boolean;
    onToggleAutoAdvance: () => void;
    allowSkip: boolean;
    onToggleAllowSkip: () => void;
    soundEnabled: boolean;
    onToggleSound: () => void;
    studyMode: boolean;
    onToggleStudyMode: () => void;
  };
}

/**
 * SỬA LỖI GIẬT/LAG KHI GÕ: mỗi ký tự gõ vào ô trả lời đổi `answerValue`
 * trong usePracticeEngine → toàn bộ MainScreen re-render → nếu không có
 * React.memo, thẻ câu hỏi này (LinearGradient + Animated progress bar,
 * nặng nhất màn hình) sẽ vẽ lại theo TỪNG PHÍM GÕ dù không prop nào của nó
 * thực sự đổi (đáp án gõ dở không ảnh hưởng gì tới nội dung thẻ). Bọc
 * React.memo để chỉ re-render khi props thật sự đổi (câu hỏi mới, đổi chế
 * độ, đổi tiến trình...). Đi kèm: MainScreen phải truyền props ỔN ĐỊNH
 * (useCallback/useMemo) cho component này, không phải hàm/object literal
 * tạo mới mỗi lần render — nếu không React.memo vô nghĩa.
 */
function ExercisePromptCard({
  question,
  typeTag,
  promptMainText,
  exerciseMode,
  onPlayAudio,
  onPlayWord,
  progressPct,
  index,
  total,
  sourceLabel,
  onToggleMastered,
  wordType,
  quickToggles,
}: ExercisePromptCardProps) {
  const { colors, prompt } = useTheme();
  const { showToast } = useToast();

  const stateKey = question.isFlagged
    ? 'flagged'
    : question.isMastered
      ? 'mastered'
      : question.isAnsweredCorrectly
        ? 'correct'
        : 'normal';
  const state = prompt[stateKey];

  // index.html: .progress-fill { transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
  // (a slight overshoot/bounce easing) — ported with Animated + a matching bezier curve.
  const progressAnim = useRef(new Animated.Value(progressPct)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPct,
      duration: 400,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: false,
    }).start();
  }, [progressPct, progressAnim]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.progressTrack, { backgroundColor: colors.bg3 }]}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>

      <View style={[styles.card, { borderColor: state.border }]}>
        <LinearGradient
          colors={state.gradient as unknown as string[]}
          locations={state.gradientLocations as unknown as number[]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.typeRow}>
          <View style={styles.typeDash} />
          <Text style={[styles.typeTag, { color: colors.tx3 }]}>{typeTag}</Text>
          {question.isFlagged && <Icon name="star" size={11} color={colors.tx} style={styles.flagIndicator} />}
        </View>

        <Pressable style={styles.questionRow} onPress={onPlayWord} disabled={!onPlayWord}>
          {exerciseMode === 'listen' && (
            <Pressable onPress={onPlayAudio} hitSlop={8} style={[styles.listenPlayBtn, { backgroundColor: 'rgba(88,166,255,0.12)' }]}>
              <Icon name="volume-up" size={15} color="#58a6ff" />
            </Pressable>
          )}
          <Text style={[styles.questionText, { color: colors.tx }]} numberOfLines={2}>
            {promptMainText}
          </Text>
          {!!wordType && (
            <View style={styles.wtBadge}>
              <Text style={styles.wtBadgeText} numberOfLines={1}>{wordType}</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.footerRow}>
          <Text style={[styles.counter, { color: colors.tx3 }]}>
            {index + 1} / {total} · {sourceLabel}
          </Text>
          {/* index.html: settingsBarHtml — 5 quick toggle icons, dim when off */}
          <View style={styles.quickRow}>
            <QuickToggle
              icon="random"
              active={quickToggles.randomMode}
              onPress={quickToggles.onToggleRandom}
              title="Ngẫu nhiên"
              showToast={showToast}
              color={colors.tx}
            />
            <QuickToggle
              icon="forward"
              active={quickToggles.autoAdvanceOnCorrect}
              onPress={quickToggles.onToggleAutoAdvance}
              title="Tự động qua câu"
              showToast={showToast}
              color={colors.tx}
            />
            <QuickToggle
              icon="unlock"
              active={quickToggles.allowSkip}
              onPress={quickToggles.onToggleAllowSkip}
              title="Cho phép bỏ qua"
              showToast={showToast}
              color={colors.tx}
            />
            <QuickToggle
              icon="volume-up"
              active={quickToggles.soundEnabled}
              onPress={quickToggles.onToggleSound}
              title="Âm thanh"
              showToast={showToast}
              color={colors.tx}
            />
            <QuickToggle
              icon="book-open"
              active={quickToggles.studyMode}
              onPress={quickToggles.onToggleStudyMode}
              title="Học bài"
              showToast={showToast}
              color={colors.tx}
            />
          </View>
        </View>

        <Pressable
          style={[
            styles.masterBadge,
            question.isMastered
              ? { backgroundColor: 'rgba(63,185,80,0.15)', borderColor: 'rgba(63,185,80,0.45)' }
              : { backgroundColor: 'rgba(88,166,255,0.08)', borderColor: 'rgba(88,166,255,0.25)' },
          ]}
          onPress={onToggleMastered}
        >
          <Text style={{ color: question.isMastered ? '#3fb950' : colors.tx2, fontSize: 11, fontWeight: '700' }}>
            {question.isMastered ? <><Icon name="check" size={9} color="#3fb950" />{' '}Thuộc</> : 'Thuộc'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default React.memo(ExercisePromptCard);

/**
 * Bật/tắt icon = "Hiển thị thông báo khi bật tắt các small icon trong
 * exPrompt" — mỗi lần bấm 1 trong 5 icon nhỏ ở góc phải thanh trạng thái
 * câu hỏi, hiện luôn 1 toast xác nhận vừa bật/tắt cái gì.
 */
function QuickToggle({
  icon,
  active,
  onPress,
  title,
  showToast,
  color,
}: {
  icon: IconProps['name'];
  active: boolean;
  onPress: () => void;
  title: string;
  showToast: (message: string, icon?: IconProps['name']) => void;
  color: string;
}) {
  const handlePress = () => {
    onPress();
    showToast(`${title}: ${active ? 'Đã tắt' : 'Đã bật'}`, icon);
  };
  return (
    <Pressable onPress={handlePress} hitSlop={4} style={[styles.quickBtn, { opacity: active ? 1 : 0.4 }]} accessibilityLabel={title}>
      <Icon name={icon} size={11} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: 3, backgroundColor: '#58a6ff' },
  card: {
    borderWidth: 1,
    borderRadius: mobile.exPromptRadius,
    paddingVertical: mobile.exPromptPaddingV,
    paddingHorizontal: mobile.exPromptPaddingH,
    overflow: 'hidden',
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingRight: 70 },
  typeDash: { width: 18, height: 2, backgroundColor: '#58a6ff', borderRadius: 1 },
  typeTag: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  flagIndicator: { fontSize: 12 },
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  listenPlayBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  questionText: { fontSize: mobile.exQuestionSize, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
  wtBadge: {
    backgroundColor: 'rgba(210,168,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(210,168,255,0.25)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 7,
    flexShrink: 0,
    alignSelf: 'center',
  },
  wtBadgeText: { color: '#d2a8ff', fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  counter: { fontSize: 12.5 },
  quickRow: { flexDirection: 'row', gap: 3, flexShrink: 0 },
  quickBtn: {
    borderWidth: 1,
    borderColor: 'rgba(139,148,158,0.3)',
    borderRadius: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  masterBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
});
