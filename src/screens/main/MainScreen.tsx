import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import Header from '@/components/Header';
import { useTheme } from '@/theme/ThemeContext';
import { useSettings } from '@/store/SettingsContext';
import { useDataStore } from '@/store/DataStore';
import { usePracticeEngine } from '@/hooks/usePracticeEngine';
import { generateChoices } from '@/utils/questionBuilder';
import { buildPromptDisplay } from '@/utils/promptDisplay';
import { buildHintContent } from '@/utils/hint';
import MobileStatsBar from '@/components/practice/MobileStatsBar';
import ExercisePromptCard from '@/components/practice/ExercisePromptCard';
import ExerciseAnswerInput from '@/components/practice/ExerciseAnswerInput';
import SpeakAnswerInput from '@/components/practice/SpeakAnswerInput';
import MCOptions from '@/components/practice/MCOptions';
import ExerciseActionsRow from '@/components/practice/ExerciseActionsRow';
import BatchPill from '@/components/practice/BatchPill';
import WordFormModal from '@/components/WordFormModal';
import FolderManagerModal from '@/components/FolderManagerModal';
import { speakForMode, speakText } from '@/services/tts';
import { getReducedTarget } from '@/utils/grading';
import { useBreakTimer } from '@/hooks/useBreakTimer';
import BreakOverlay from '@/components/BreakOverlay';
import GlobalSearchModal from '@/components/GlobalSearchModal';
import SettingsModal from '@/components/SettingsModal';
import Icon from '@/components/Icon';
import BulkSelectModal from '@/components/BulkSelectModal';
import { useListenModeCtx } from '@/store/ListenModeContext';
import { useToast } from '@/store/ToastContext';

/**
 * Full rebuild of the practice screen (#exerciseArea / .ex-card in
 * index.html). This revision fixes a real bug + real gaps found by
 * comparing screenshots against the live original app:
 *  - ExerciseActionsRow buttons were stretching to fill the screen height
 *    (unconstrained horizontal ScrollView) — fixed, see that file.
 *  - The bottom button row had the WRONG set of buttons (mode/type
 *    cyclers) — the real #exBtnsRow is Hint/Flag/Edit/Prev/Next. Mode and
 *    type switching actually lives in #mobileStatsBar as two dropdowns
 *    next to the stats, which is where it is now.
 *  - Missing: purple word-type badge, the 5-icon quick-settings row inline
 *    with the question counter, and the toggleable hint box.
 */
export default function MainScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const engine = usePracticeEngine();
  const { sessions, updateWord, deleteWordForSession, vocab, mergedVocab, source, currentSessionId } = useDataStore();
  const { soundEnabled, toggleSound, autoHideHint } = useSettings();
  const breakTimer = useBreakTimer();
  const listenMode = useListenModeCtx();
  const { showToast } = useToast();
  const [searchVisible, setSearchVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [folderVisible, setFolderVisible] = useState(false);
  const [bulkSelectVisible, setBulkSelectVisible] = useState(false);

  const {
    currentQuestion,
    questions,
    currentIndex,
    effectiveType,
    exerciseType,
    exerciseMode,
    stats,
    answerValue,
    inputStatus,
    revealedExample,
    onAnswerChange,
    submitStudyAnswer,
    submitSpokenAnswer,
    submitChoice,
    moveNext,
    moveToPrev,
    resetPractice,
    skip,
    canSkip,
    toggleCurrentMastered,
    toggleCurrentFlagged,
    wordLimit,
    batchIdx,
    goToBatch,
    totalBatches,
    randomMode,
    setRandomMode,
    autoAdvanceOnCorrect,
    setAutoAdvanceOnCorrect,
    allowSkip,
    setAllowSkip,
    studyMode,
    setStudyMode,
  } = engine;

  const display = useMemo(
    () => (currentQuestion ? buildPromptDisplay(currentQuestion, effectiveType, exerciseType, exerciseMode) : null),
    [currentQuestion, effectiveType, exerciseType, exerciseMode]
  );

  const choices = useMemo(() => {
    if (!currentQuestion || exerciseMode !== 'choose') return [];
    return generateChoices(currentQuestion, questions, effectiveType, exerciseMode);
  }, [currentQuestion, questions, effectiveType, exerciseMode]);

  const hintContent = useMemo(() => {
    if (!currentQuestion || !hintVisible) return null;
    return buildHintContent(currentQuestion, effectiveType, exerciseMode, answerValue);
  }, [currentQuestion, hintVisible, effectiveType, exerciseMode, answerValue]);

  const progressPct = questions.length ? ((currentIndex + 1) / questions.length) * 100 : 0;

  // ── ỔN ĐỊNH THAM CHIẾU PROPS CHO CÁC COMPONENT ĐÃ BỌC React.memo ─────────
  // Lý do cần khối này: mỗi ký tự gõ vào ô trả lời đổi `answerValue` trong
  // usePracticeEngine → MainScreen re-render. Nếu các hàm/object dưới đây
  // được tạo MỚI ngay trong JSX (như trước đây), React.memo ở
  // ExercisePromptCard/ExerciseActionsRow/MobileStatsBar/BatchPill sẽ vô
  // tác dụng vì props "trông giống nhau nhưng khác tham chiếu" vẫn bị coi
  // là đổi. Dùng setState dạng hàm (setX(v => !v)) để useCallback không cần
  // phụ thuộc vào giá trị hiện tại — nhờ vậy tham chiếu hàm không đổi theo
  // từng phím gõ, chỉ đổi khi bản thân logic thay đổi.
  const onToggleRandom = useCallback(() => setRandomMode((v) => !v), [setRandomMode]);
  const onToggleAutoAdvance = useCallback(() => setAutoAdvanceOnCorrect((v) => !v), [setAutoAdvanceOnCorrect]);
  const onToggleAllowSkip = useCallback(() => setAllowSkip((v) => !v), [setAllowSkip]);
  const onToggleStudyMode = useCallback(() => setStudyMode((v) => !v), [setStudyMode]);
  const onToggleHint = useCallback(() => setHintVisible((v) => !v), []);
  const onOpenEdit = useCallback(() => setEditVisible(true), []);
  const onCloseEdit = useCallback(() => setEditVisible(false), []);

  const quickToggles = useMemo(
    () => ({
      randomMode,
      onToggleRandom,
      autoAdvanceOnCorrect,
      onToggleAutoAdvance,
      allowSkip,
      onToggleAllowSkip,
      soundEnabled,
      onToggleSound: toggleSound,
      studyMode,
      onToggleStudyMode,
    }),
    [
      randomMode,
      onToggleRandom,
      autoAdvanceOnCorrect,
      onToggleAutoAdvance,
      allowSkip,
      onToggleAllowSkip,
      soundEnabled,
      toggleSound,
      studyMode,
      onToggleStudyMode,
    ]
  );

  const onPlayAudio = useCallback(() => {
    if (currentQuestion) speakForMode(currentQuestion, effectiveType, engine.strictVocabCheck);
  }, [currentQuestion, effectiveType, engine.strictVocabCheck]);

  const onPlayWord = useCallback(() => {
    if (!currentQuestion) return;
    const reduced = getReducedTarget(currentQuestion.fullDisplayGerman, engine.strictVocabCheck);
    speakText(reduced !== null ? reduced : currentQuestion.fullDisplayGerman);
  }, [currentQuestion, engine.strictVocabCheck]);

  const sourceLabel = useMemo(() => {
    if (!currentQuestion) return 'Phiên';
    return engine.source === 'merged'
      ? sessions.find((s) => s.id === currentQuestion._sessId)?.name || 'Phiên'
      : 'Phiên';
  }, [engine.source, sessions, currentQuestion]);

  const goToPrevBatch = useCallback(() => goToBatch(batchIdx - 1), [goToBatch, batchIdx]);
  const goToNextBatch = useCallback(() => goToBatch(batchIdx + 1), [goToBatch, batchIdx]);


  // Item 3: "Tự tắt gợi ý khi sang từ tiếp theo" — mỗi khi câu hỏi đổi
  // (đúng/sai/bỏ qua/lùi lại/đổi batch...), tự ẩn khối Gợi ý nếu cài đặt
  // này đang bật, tránh gợi ý của từ CŨ còn hiện ra khi câu MỚI vừa tới.
  useEffect(() => {
    if (autoHideHint) setHintVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, autoHideHint]);

  // Chỉ nhấn "OK"/"Done" trên bàn phím (onSubmitEditing) mới bị chặn khi câu
  // hiện tại còn sai và "Cho phép bỏ qua câu" đang tắt — báo cho người dùng
  // biết vì sao thay vì im lặng không phản hồi gì. Nút "⏭ Từ tiếp theo" và
  // "⏮ Từ trước đó" trong ExerciseActionsRow KHÔNG đi qua hàm này nữa, luôn
  // hoạt động bất kể trạng thái đúng/sai hay công tắc allowSkip.
  const handleNext = () => {
    if (studyMode) {
      // Chế độ học bài (phần viết): Enter/gửi câu trả lời mới chấm điểm —
      // đúng thì hiện viền xanh rồi mới xoá trắng để gõ lại; sai thì báo lỗi
      // (viền đỏ) và GIỮ NGUYÊN nội dung đã gõ để tự sửa, không tự chuyển câu.
      submitStudyAnswer();
      return;
    }
    if (!canSkip) {
      showToast('Trả lời đúng để chuyển câu, hoặc bật "Cho phép bỏ qua câu" trong cài đặt');
      return;
    }
    skip();
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <Header
        onOpenDrawer={() => navigation.dispatch(DrawerActions.openDrawer())}
        onBulkSelect={() => setBulkSelectVisible(true)}
        onGlobalSearch={() => setSearchVisible(true)}
        onSettings={() => setSettingsVisible(true)}
        onFolderManager={() => setFolderVisible(true)}
        onListenMode={() =>
          listenMode.openWithWords(
            source === 'merged' ? mergedVocab : vocab,
            source === 'merged' ? 'Nhiều phiên' : sessions.find((s) => s.id === currentSessionId)?.name || 'Nghe từ vựng'
          )
        }
      />
      <MobileStatsBar
        correct={stats.correct}
        total={stats.total}
        exerciseType={exerciseType}
        onChangeExerciseType={engine.setExerciseType}
        exerciseMode={exerciseMode}
        onChangeExerciseMode={engine.setExerciseMode}
        onReset={resetPractice}
      />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!currentQuestion || !display ? (
          <View style={styles.emptyBox}>
            <Icon name="trophy" size={30} color="#d29922" style={{ marginBottom: 10 }} />
            <Text style={{ color: colors.tx2, fontSize: 15, textAlign: 'center' }}>
              Không còn từ nào để luyện trong phiên này!{'\n'}Thêm từ mới ở sidebar để tiếp tục.
            </Text>
          </View>
        ) : (
          <>
            <ExercisePromptCard
              question={currentQuestion}
              typeTag={display.typeTag}
              promptMainText={display.mainText}
              exerciseMode={exerciseMode}
              wordType={currentQuestion.wordType}
              onPlayAudio={onPlayAudio}
              // Item 7: chạm vào thẻ câu hỏi luôn phát âm NGUYÊN TỪ tiếng Đức
              // của từ đang luyện — độc lập với effectiveType (khác với
              // onPlayAudio ở trên, vốn có thể đọc nghĩa/câu ví dụ tuỳ chế
              // độ đang luyện). Kiểm tra chặt TẮT → chỉ đọc nguyên từ, bỏ
              // phần chia động từ trong ngoặc (vd "gehen (ging, ist
              // gegangen)" chỉ đọc "gehen") — trước đây luôn đọc nguyên văn
              // fullDisplayGerman kể cả khi tắt kiểm tra chặt.
              onPlayWord={onPlayWord}
              progressPct={progressPct}
              index={currentIndex}
              total={questions.length}
              sourceLabel={sourceLabel}
              onToggleMastered={toggleCurrentMastered}
              quickToggles={quickToggles}
            />

            {exerciseMode === 'choose' ? (
              <MCOptions
                choices={choices}
                disabled={false}
                resetKey={currentQuestion.id}
                onSelect={submitChoice}
              />
            ) : exerciseMode === 'speak' ? (
              <SpeakAnswerInput
                value={answerValue}
                status={inputStatus}
                onResult={submitSpokenAnswer}
                lang={effectiveType === 'fullMeaning' ? 'vi-VN' : 'de-DE'}
                questionKey={currentQuestion.id}
                placeholder={effectiveType === 'fullSentence' ? 'Nhấn mic và đọc câu ví dụ...' : 'Nhấn mic và phát âm...'}
              />
            ) : (
              <ExerciseAnswerInput
                value={answerValue}
                status={inputStatus}
                onChangeText={onAnswerChange}
                onSubmit={handleNext}
                questionKey={currentQuestion.id}
                placeholder={effectiveType === 'fullSentence' ? 'Nhập câu ví dụ...' : 'Nhập câu trả lời...'}
              />
            )}

            <ExerciseActionsRow
              hintVisible={hintVisible}
              onToggleHint={onToggleHint}
              isFlagged={currentQuestion.isFlagged}
              onToggleFlag={toggleCurrentFlagged}
              onEdit={onOpenEdit}
              onPrev={moveToPrev}
              onNext={moveNext}
            />

            {hintContent && (
              <View style={[styles.hintBox, { backgroundColor: 'rgba(210,168,255,0.07)', borderColor: 'rgba(210,168,255,0.2)' }]}>
                {hintContent.kind === 'text' ? (
                  <Text style={{ color: '#d2a8ff', fontSize: 14.4, fontFamily: 'DM Mono' }}>{hintContent.text}</Text>
                ) : (
                  <Text style={{ fontSize: 14.4, fontFamily: 'DM Mono' }}>
                    {hintContent.chars.map((c, i) => (
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
            )}

            {revealedExample && (
              <View style={[styles.exampleBox, { backgroundColor: colors.bg3, borderColor: colors.border2 }]}>
                <Text style={{ color: colors.tx3, fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' }}>
                  <Icon name="pencil-alt" size={9} color={colors.tx3} />{'  '}Ví dụ
                </Text>
                <Text style={{ color: colors.tx2, fontSize: 13, marginTop: 3 }}>{revealedExample}</Text>
              </View>
            )}

            <WordFormModal
              visible={editVisible}
              onClose={onCloseEdit}
              initialWord={{
                id: currentQuestion._realId ?? currentQuestion.id,
                originalGerman: currentQuestion.fullDisplayGerman,
                mainGerman: currentQuestion.mainGerman,
                meaning: currentQuestion.meaning,
                wordType: currentQuestion.wordType,
                example: currentQuestion.example,
              }}
              onSubmit={async (w) => {
                await updateWord({
                  id: currentQuestion._realId ?? currentQuestion.id,
                  ...w,
                });
              }}
              onDelete={async () => {
                await deleteWordForSession(currentQuestion._sessId, currentQuestion._realId ?? currentQuestion.id);
                showToast('Đã xoá từ', 'trash');
              }}
            />
          </>
        )}
      </ScrollView>

      <BatchPill
        visible={!!wordLimit}
        current={batchIdx}
        total={totalBatches}
        onPrev={goToPrevBatch}
        onNext={goToNextBatch}
      />

      <BreakOverlay visible={breakTimer.isBreakActive} formattedTime={breakTimer.formattedTime} />
      <GlobalSearchModal visible={searchVisible} onClose={() => setSearchVisible(false)} />
      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} engine={engine} />
      <FolderManagerModal visible={folderVisible} onClose={() => setFolderVisible(false)} engine={engine} />
      <BulkSelectModal visible={bulkSelectVisible} onClose={() => setBulkSelectVisible(false)} engine={engine} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { paddingVertical: 12, paddingHorizontal: 10, flexGrow: 1 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  exampleBox: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 12 },
  hintBox: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 10 },
});
