import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDataStore } from '@/store/DataStore';
import { useAuth } from '@/store/AuthContext';
import {
  buildQuestionList,
  buildMergedQuestionListFromPool,
  getEffectiveType,
  type ExerciseType,
  type ExerciseMode,
  type Question,
} from '@/utils/questionBuilder';
import {
  isMeaningMatch,
  isSentenceMatch,
  checkWriteAnswer,
  checkSpeakWordAnswer,
  getReducedTarget,
  getGermanExample,
} from '@/utils/grading';
import { speakForMode, speakText } from '@/services/tts';

/**
 * Practice engine — mirrors the module-level exercise state in index.html
 * (currentQuestionsList, currentQIndex, exerciseMode, currentExerciseType,
 * _mixRound, stats, onInputChange, moveNext, updateBatchBar) as one hook.
 *
 * DEFERRED to Phase 6 (kept as a no-op hook here, documented in README):
 *  - actual TTS playback (speakText/speakForMode) for "listen" mode and the
 *    auto-pronounce-on-correct behavior
 *  - live per-keystroke character hint box (buildCharHint) — a large
 *    diffing algorithm; this phase keeps the core ACCEPT/REJECT grading
 *    (which is the safety-critical part) but not the hint rendering
 *
 * DEFERRED to Phase 8 (Search + Stats):
 *  - merged multi-session practice (currentSource === "merged")
 *
 * PERSISTENCE (AsyncStorage) — trước đây mọi cài đặt luyện tập (số từ mỗi
 * batch, chế độ ngẫu nhiên, loại bài tập...) và cả tiến trình đang học
 * (thứ tự từ, đang ở batch nào, đang ở câu nào) đều là state cục bộ, mất
 * sạch mỗi khi mở lại app. Giờ chia làm 2 nhóm lưu riêng:
 *  - ENGINE_KEYS: cài đặt chung, áp dụng lại ngay khi hook khởi tạo.
 *  - studyStateKeyFor(...): tiến trình học GẮN VỚI TỪNG PHIÊN (session id
 *    hoặc "merged") — thứ tự câu hỏi hiện tại (đặc biệt quan trọng khi
 *    randomMode bật, để không bị xáo lại từ đầu mỗi lần vào app), batchIdx,
 *    currentIndex.
 */
const DEFAULT_WORD_LIMIT = 0; // 0 = no batching, matches original's default (wordLimit unset)

const ENGINE_KEYS = {
  exerciseType: 'beitl_engine_exerciseType',
  exerciseMode: 'beitl_engine_exerciseMode',
  onlyUnmastered: 'beitl_engine_onlyUnmastered',
  strictVocabCheck: 'beitl_engine_strictVocabCheck',
  randomMode: 'beitl_engine_randomMode',
  autoAdvanceOnCorrect: 'beitl_engine_autoAdvanceOnCorrect',
  studyMode: 'beitl_engine_studyMode',
  allowSkip: 'beitl_engine_allowSkip',
  wordLimit: 'beitl_engine_wordLimit',
};

const STUDY_STATE_PREFIX = 'beitl_study_';
function studyStateKeyFor(source: 'session' | 'merged', currentSessionId: string | null) {
  return STUDY_STATE_PREFIX + (source === 'merged' ? 'merged' : currentSessionId ?? 'none');
}

interface PersistedStudyState {
  order: string[]; // Question.id theo đúng thứ tự đang học (kể cả khi đã xáo ngẫu nhiên)
  batchIdx: number;
  currentIndex: number;
  mixRound?: number; // lượt hiện tại của chế độ Hỗn hợp (0 = nguyên từ, 1 = nghĩa) — lưu lại để không bị reset về "nguyên từ" mỗi khi tải lại tiến trình
}

export function usePracticeEngine() {
  const { user } = useAuth();
  const {
    vocab,
    masteredIds,
    flaggedIds,
    currentSessionId,
    toggleMastered,
    toggleFlagged,
    source,
    setSource,
    mergedSessionIds,
    setMergedSessionIds,
    mergedVocab,
    mergedMasteredIds,
    mergedFlaggedIds,
    toggleMasteredForSession,
    toggleFlaggedForSession,
  } = useDataStore();

  const [exerciseType, setExerciseType] = useState<ExerciseType>('fullWord');
  const [exerciseMode, setExerciseMode] = useState<ExerciseMode>('write');
  const [onlyUnmastered, setOnlyUnmastered] = useState(true);
  // null = chưa lọc gì (mặc định luyện tất cả các từ hợp lệ theo onlyUnmastered)
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string> | null>(null);
  const [strictVocabCheck, setStrictVocabCheck] = useState(true);
  const [randomMode, setRandomMode] = useState(false);
  const [autoAdvanceOnCorrect, setAutoAdvanceOnCorrect] = useState(true);
  const [studyMode, setStudyMode] = useState(false);
  const [allowSkip, setAllowSkip] = useState(false);

  const [mixRound, setMixRound] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerValue, setAnswerValue] = useState('');
  const [inputStatus, setInputStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [revealedExample, setRevealedExample] = useState<string | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [wordLimit, setWordLimit] = useState(DEFAULT_WORD_LIMIT);
  const [batchIdx, setBatchIdx] = useState(0);

  const waitingForAutoNext = useRef(false);
  // true sau khi đã nạp xong cài đặt từ AsyncStorage lần đầu — dùng để chặn
  // các effect lưu-lại chạy (và ghi đè lên giá trị đã lưu) trong lúc state
  // còn đang ở giá trị mặc định trước khi kịp nạp.
  const settingsLoadedRef = useRef(false);
  // Cache tiến trình học đã đọc từ AsyncStorage, theo từng session key — chỉ
  // cần đọc 1 lần cho mỗi session/merged, effect xây danh sách câu hỏi bên
  // dưới sẽ tra cứu đồng bộ từ đây.
  const studyStateCacheRef = useRef<Map<string, PersistedStudyState | null>>(new Map());
  const [studyStateLoadTick, setStudyStateLoadTick] = useState(0);

  // Nạp cài đặt đã lưu (nếu có) một lần khi hook khởi tạo — chạy trước khi
  // effect xây danh sách câu hỏi bên dưới dùng tới các giá trị này.
  useEffect(() => {
    (async () => {
      try {
        const entries = await AsyncStorage.multiGet(Object.values(ENGINE_KEYS));
        const map = Object.fromEntries(entries);
        if (map[ENGINE_KEYS.exerciseType]) setExerciseType(map[ENGINE_KEYS.exerciseType] as ExerciseType);
        if (map[ENGINE_KEYS.exerciseMode]) setExerciseMode(map[ENGINE_KEYS.exerciseMode] as ExerciseMode);
        if (map[ENGINE_KEYS.onlyUnmastered] != null) setOnlyUnmastered(map[ENGINE_KEYS.onlyUnmastered] !== 'false');
        if (map[ENGINE_KEYS.strictVocabCheck] != null) setStrictVocabCheck(map[ENGINE_KEYS.strictVocabCheck] !== 'false');
        if (map[ENGINE_KEYS.randomMode] != null) setRandomMode(map[ENGINE_KEYS.randomMode] === 'true');
        if (map[ENGINE_KEYS.autoAdvanceOnCorrect] != null) setAutoAdvanceOnCorrect(map[ENGINE_KEYS.autoAdvanceOnCorrect] !== 'false');
        if (map[ENGINE_KEYS.studyMode] != null) setStudyMode(map[ENGINE_KEYS.studyMode] === 'true');
        if (map[ENGINE_KEYS.allowSkip] != null) setAllowSkip(map[ENGINE_KEYS.allowSkip] === 'true');
        if (map[ENGINE_KEYS.wordLimit] != null) {
          const n = parseInt(map[ENGINE_KEYS.wordLimit] as string, 10);
          if (!Number.isNaN(n)) setWordLimit(n);
        }
      } catch {
        // Không nghiêm trọng — chỉ đơn giản là dùng lại giá trị mặc định.
      } finally {
        settingsLoadedRef.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AsyncStorage.setItem(ENGINE_KEYS.exerciseType, exerciseType);
  }, [exerciseType]);
  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AsyncStorage.setItem(ENGINE_KEYS.exerciseMode, exerciseMode);
  }, [exerciseMode]);
  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AsyncStorage.setItem(ENGINE_KEYS.onlyUnmastered, String(onlyUnmastered));
  }, [onlyUnmastered]);
  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AsyncStorage.setItem(ENGINE_KEYS.strictVocabCheck, String(strictVocabCheck));
  }, [strictVocabCheck]);
  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AsyncStorage.setItem(ENGINE_KEYS.randomMode, String(randomMode));
  }, [randomMode]);
  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AsyncStorage.setItem(ENGINE_KEYS.autoAdvanceOnCorrect, String(autoAdvanceOnCorrect));
  }, [autoAdvanceOnCorrect]);
  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AsyncStorage.setItem(ENGINE_KEYS.studyMode, String(studyMode));
  }, [studyMode]);
  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AsyncStorage.setItem(ENGINE_KEYS.allowSkip, String(allowSkip));
  }, [allowSkip]);
  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    AsyncStorage.setItem(ENGINE_KEYS.wordLimit, String(wordLimit));
  }, [wordLimit]);

  // Full pool for the current source (session or merged), always including
  // mastered words — used both to build the practice list below (subject to
  // onlyUnmastered) and exposed as `selectionPool` for the "Chọn từ luyện
  // tập" modal, which needs to offer every word regardless of that flag.
  const selectionPool = useMemo(() => {
    if (source === 'merged') {
      return buildMergedQuestionListFromPool(mergedVocab, mergedMasteredIds, mergedFlaggedIds, true);
    }
    if (!currentSessionId) return [];
    return buildQuestionList(vocab, masteredIds, flaggedIds, currentSessionId, true);
  }, [source, mergedVocab, mergedMasteredIds, mergedFlaggedIds, vocab, masteredIds, flaggedIds, currentSessionId]);

  const studyStateKey = studyStateKeyFor(source, currentSessionId);

  // Đọc tiến trình đã lưu (thứ tự câu hỏi + batch + vị trí) cho session hiện
  // tại — chỉ đọc 1 lần cho mỗi session key, cache lại trong ref. Effect xây
  // danh sách câu hỏi bên dưới phụ thuộc studyStateLoadTick để chạy lại
  // đúng một lần ngay sau khi cache có dữ liệu.
  useEffect(() => {
    if (studyStateCacheRef.current.has(studyStateKey)) return;
    let cancelled = false;
    (async () => {
      let parsed: PersistedStudyState | null = null;
      try {
        const raw = await AsyncStorage.getItem(studyStateKey);
        if (raw) parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      if (cancelled) return;
      studyStateCacheRef.current.set(studyStateKey, parsed);
      setStudyStateLoadTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [studyStateKey]);

  useEffect(() => {
    if (!currentSessionId || !user) return;

    let list: Question[] = onlyUnmastered ? selectionPool.filter((q) => !q.isMastered) : selectionPool;
    // "Chọn từ luyện tập" (bulk select) — nếu người dùng đã áp dụng một tập
    // từ cụ thể, chỉ giữ lại các câu hỏi thuộc tập đó. selectedWordIds dùng
    // _realId khi ở chế độ merged (id gốc của từ), ngược lại dùng id câu hỏi.
    if (selectedWordIds) {
      list = list.filter((q) => selectedWordIds.has(q._realId ?? q.id));
    }

    const saved = studyStateCacheRef.current.get(studyStateKey);
    if (saved && saved.order.length) {
      // Áp lại đúng thứ tự đã lưu (quan trọng nhất khi randomMode bật — để
      // không bị xáo lại từ đầu mỗi lần vào app). Từ nào không còn trong
      // danh sách đã lưu (mới thêm, hoặc do đổi bộ lọc) được xáo/thêm vào
      // cuối; từ nào trong thứ tự đã lưu mà giờ không còn hợp lệ thì bỏ qua.
      const byId = new Map(list.map((q) => [q.id, q]));
      const ordered: Question[] = [];
      for (const id of saved.order) {
        const q = byId.get(id);
        if (q) {
          ordered.push(q);
          byId.delete(id);
        }
      }
      const rest = Array.from(byId.values());
      if (randomMode) rest.sort(() => Math.random() - 0.5);
      list = [...ordered, ...rest];
      setQuestions(list);
      setBatchIdx(Math.min(saved.batchIdx, wordLimit ? Math.max(0, Math.ceil(list.length / wordLimit) - 1) : 0));
      setCurrentIndex(saved.currentIndex < list.length ? saved.currentIndex : 0);
      setMixRound(saved.mixRound === 1 ? 1 : 0);
    } else {
      if (randomMode) list = [...list].sort(() => Math.random() - 0.5);
      setQuestions(list);
      setCurrentIndex((i) => (i >= list.length ? 0 : i));
      setBatchIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionPool, currentSessionId, onlyUnmastered, randomMode, user?.uid, selectedWordIds, studyStateLoadTick, studyStateKey]);

  // Lưu lại tiến trình (thứ tự câu hỏi hiện tại + batch + vị trí câu) mỗi
  // khi thay đổi, để vào lại app/đổi màn hình không bị mất chỗ đang học.
  useEffect(() => {
    if (!studyStateCacheRef.current.has(studyStateKey)) return; // chưa đọc xong lần đầu — tránh ghi đè bằng state rỗng
    if (!questions.length) return;
    const payload: PersistedStudyState = {
      order: questions.map((q) => q.id),
      batchIdx,
      currentIndex,
      mixRound,
    };
    studyStateCacheRef.current.set(studyStateKey, payload);
    AsyncStorage.setItem(studyStateKey, JSON.stringify(payload));
  }, [studyStateKey, questions, batchIdx, currentIndex, mixRound]);

  const visibleQuestions = useMemo(() => {
    if (!wordLimit) return questions;
    const start = batchIdx * wordLimit;
    return questions.slice(start, start + wordLimit);
  }, [questions, wordLimit, batchIdx]);

  const totalBatches = wordLimit ? Math.max(1, Math.ceil(questions.length / wordLimit)) : 1;

  const currentQuestion: Question | undefined = visibleQuestions[currentIndex % (visibleQuestions.length || 1)];
  const effectiveType = getEffectiveType(exerciseType, mixRound);

  // index.html: every call site that lands on a new question in listen mode
  // immediately calls speakForMode(q) — session switch, moveNext, mode/type
  // change, batch change, etc. A single effect keyed on the question + mode
  // covers all of those cases here.
  useEffect(() => {
    if (exerciseMode === 'listen' && currentQuestion) {
      speakForMode(currentQuestion, effectiveType, strictVocabCheck);
    }
  }, [currentQuestion?.id, exerciseMode, effectiveType, strictVocabCheck]);

  function resetInputUI() {
    setAnswerValue('');
    setInputStatus('idle');
    setRevealedExample(null);
  }

  // Vừa đi hết 1 vòng của batch hiện tại (hoặc cả danh sách, nếu không chia
  // batch) — index.html không có hành vi này, đây là yêu cầu mới: xáo lại
  // ngẫu nhiên thứ tự các từ TRONG batch đó (không đụng tới các batch khác)
  // để lượt luyện tiếp theo không lặp lại đúng thứ tự cũ.
  const shuffleCurrentBatch = useCallback(() => {
    setQuestions((prev) => {
      const start = wordLimit ? batchIdx * wordLimit : 0;
      const end = wordLimit ? Math.min(start + wordLimit, prev.length) : prev.length;
      if (end - start <= 1) return prev; // chưa đủ 2 từ thì khỏi xáo
      const segment = prev.slice(start, end).sort(() => Math.random() - 0.5);
      return [...prev.slice(0, start), ...segment, ...prev.slice(end)];
    });
  }, [wordLimit, batchIdx]);

  const moveNext = useCallback(() => {
    resetInputUI();
    setCurrentIndex((i) => {
      const len = visibleQuestions.length || 1;
      const next = i + 1;
      if (next >= len) {
        if (exerciseType === 'mixedRandom') setMixRound((r) => (r + 1) % 2);
        shuffleCurrentBatch();
        return 0;
      }
      return next;
    });
  }, [visibleQuestions.length, exerciseType, shuffleCurrentBatch]);

  // "Nghe" (listen) không còn là một cách chấm riêng — nó chỉ đổi cách ĐỀ
  // BÀI được đưa ra (đọc thay vì hiện chữ). Mục tiêu gõ vẫn theo đúng
  // effectiveType y hệt chế độ viết/chọn: fullWord luôn nhắm tới nguyên từ
  // tiếng Đức, fullMeaning luôn nhắm tới nghĩa tiếng Việt.
  function computeIsCorrect(val: string): boolean {
    if (!currentQuestion) return false;
    if (effectiveType === 'fullWord') {
      // Chế độ "Phát âm" (nói nguyên từ): danh từ dạng "das Mittel / die
      // Mittel" chỉ cần đọc đúng dạng SỐ ÍT, không bắt đọc luôn số nhiều.
      if (exerciseMode === 'speak') {
        return checkSpeakWordAnswer(val, currentQuestion.fullDisplayGerman, strictVocabCheck);
      }
      return checkWriteAnswer(val, currentQuestion.fullDisplayGerman, strictVocabCheck);
    }
    if (effectiveType === 'fullMeaning') return isMeaningMatch(val, currentQuestion.meaning);
    if (effectiveType === 'fullSentence') return isSentenceMatch(val, currentQuestion.example);
    return false;
  }

  // Viền cảnh báo khi ĐÃ GÕ SAI (không dùng để khẳng định đúng) — dựa vào độ
  // dài sau khi bỏ khoảng trắng/dấu câu so với đáp án đúng: gõ chưa đủ dài
  // thì vẫn coi là 'idle' (đang gõ dở), gõ đủ/dài hơn đáp án mà vẫn chưa
  // khớp thì mới báo 'wrong'.
  function wrongLengthHint(val: string): 'idle' | 'wrong' {
    if (!currentQuestion) return 'idle';
    if (!val.length || effectiveType === 'fullSentence') return 'idle';
    const strip = (s: string) => s.replace(/[\s/\\().,\-_=+!?;:'"<>·[\]{}]/g, '');
    const valFlat = strip(val);
    const targetRaw =
      effectiveType === 'fullMeaning'
        ? currentQuestion.meaning
        : getReducedTarget(currentQuestion.fullDisplayGerman, strictVocabCheck) ?? currentQuestion.fullDisplayGerman;
    const targetFlat = strip(targetRaw);
    return valFlat.length >= targetFlat.length ? 'wrong' : 'idle';
  }

  const onAnswerChange = useCallback(
    (val: string) => {
      setAnswerValue(val);
      if (waitingForAutoNext.current || !currentQuestion) return;

      const ok = computeIsCorrect(val);

      if (ok) {
        setInputStatus('correct');
        if (!currentQuestion.isAnsweredCorrectly) {
          currentQuestion.isAnsweredCorrectly = true;
          setStats((s) => ({ correct: s.correct + 1, total: s.total + 1 }));
          if (currentQuestion.example && effectiveType !== 'fullSentence') {
            setRevealedExample(currentQuestion.example);
          }
          // index.html: "Chỉ phát âm khi KHÔNG phải listen mode" (already spoken as the question)
          if (exerciseMode !== 'listen') {
            if (effectiveType === 'fullSentence' && currentQuestion.example) {
              speakText(getGermanExample(currentQuestion.example));
            } else {
              const reduced = getReducedTarget(currentQuestion.fullDisplayGerman, strictVocabCheck);
              speakText(reduced !== null ? reduced : currentQuestion.fullDisplayGerman);
            }
          }
        }
        if (!studyMode && autoAdvanceOnCorrect) {
          waitingForAutoNext.current = true;
          setTimeout(
            () => {
              moveNext();
              waitingForAutoNext.current = false;
            },
            effectiveType === 'fullSentence' ? 1000 : 500
          );
        }
        // Chế độ học bài: vẫn báo đúng ngay (viền xanh) như bình thường,
        // NHƯNG không tự xoá/lặp lại ở đây nữa — người dùng phải chủ động
        // bấm Enter/gửi câu trả lời (xem submitStudyAnswer) mới xoá trắng và
        // bắt gõ lại từ này.
      } else {
        if (currentQuestion.isAnsweredCorrectly) {
          currentQuestion.isAnsweredCorrectly = false;
          setRevealedExample(null);
        }
        setInputStatus(wrongLengthHint(val));
      }
    },
    [currentQuestion, exerciseMode, effectiveType, strictVocabCheck, studyMode, autoAdvanceOnCorrect, moveNext]
  );

  // Chế độ học bài (phần viết/nghe) — onAnswerChange ở trên vẫn tự chấm
  // ngay khi đang gõ (viền xanh/đỏ như bình thường), CHỈ KHÁC là không tự
  // xoá/lặp lại. Hàm này được gọi khi người dùng CHỦ ĐỘNG bấm Enter/gửi câu
  // trả lời:
  //  - Đúng: đảm bảo đã tính điểm (nếu là lần đầu đúng của từ này), rồi mới
  //    xoá trắng ô nhập và bắt gõ lại chính từ này lần nữa.
  //  - Sai: hiện viền đỏ báo lỗi, GIỮ NGUYÊN nội dung đã gõ để người dùng tự
  //    sửa và Enter lại — không tự xoá, không tự chuyển câu.
  const submitStudyAnswer = useCallback(() => {
    if (!studyMode || !currentQuestion || waitingForAutoNext.current) return;

    const ok = computeIsCorrect(answerValue);

    if (!ok) {
      setInputStatus('wrong');
      return;
    }

    setInputStatus('correct');
    if (!currentQuestion.isAnsweredCorrectly) {
      currentQuestion.isAnsweredCorrectly = true;
      setStats((s) => ({ correct: s.correct + 1, total: s.total + 1 }));
      if (currentQuestion.example && effectiveType !== 'fullSentence') {
        setRevealedExample(currentQuestion.example);
      }
      if (exerciseMode !== 'listen') {
        if (effectiveType === 'fullSentence' && currentQuestion.example) {
          speakText(getGermanExample(currentQuestion.example));
        } else {
          const reduced = getReducedTarget(currentQuestion.fullDisplayGerman, strictVocabCheck);
          speakText(reduced !== null ? reduced : currentQuestion.fullDisplayGerman);
        }
      }
    }
    // Lặp lại đúng 1 từ: xoá trắng và bắt gõ lại, cho tới khi chủ động bấm
    // "Từ tiếp theo"/bỏ qua (canSkip).
    waitingForAutoNext.current = true;
    setTimeout(
      () => {
        setAnswerValue('');
        setInputStatus('idle');
        waitingForAutoNext.current = false;
      },
      effectiveType === 'fullSentence' ? 1000 : 500
    );
  }, [studyMode, currentQuestion, answerValue, effectiveType, exerciseMode, strictVocabCheck]);

  // Chế độ luyện "Phát âm": mỗi lần bấm mic nói xong LÀ một lượt trả lời
  // hoàn chỉnh (khác Viết — không có khái niệm "đang gõ dở"), nên không cần
  // tách riêng bước xác nhận như submitStudyAnswer — chấm ngay khi có kết
  // quả nhận diện giọng nói, dùng lại đúng logic so khớp (computeIsCorrect)
  // của chế độ Viết.
  const submitSpokenAnswer = useCallback(
    (transcript: string) => {
      if (!currentQuestion) return;
      setAnswerValue(transcript);
      const ok = computeIsCorrect(transcript);

      if (ok) {
        setInputStatus('correct');
        if (!currentQuestion.isAnsweredCorrectly) {
          currentQuestion.isAnsweredCorrectly = true;
          setStats((s) => ({ correct: s.correct + 1, total: s.total + 1 }));
          if (currentQuestion.example && effectiveType !== 'fullSentence') {
            setRevealedExample(currentQuestion.example);
          }
          // Người dùng vừa tự đọc lên rồi — khỏi cần TTS phát âm mẫu lại
          // (khác Viết/Chọn, ở đó phát âm mẫu để củng cố).
        }
        if (!studyMode && autoAdvanceOnCorrect) {
          waitingForAutoNext.current = true;
          setTimeout(
            () => {
              moveNext();
              waitingForAutoNext.current = false;
            },
            effectiveType === 'fullSentence' ? 1000 : 500
          );
        }
        // Chế độ học bài: không tự chuyển câu — người dùng cứ bấm mic nói
        // lại từ này bất kỳ lúc nào, tới khi chủ động bấm "Từ tiếp theo".
      } else {
        if (currentQuestion.isAnsweredCorrectly) {
          currentQuestion.isAnsweredCorrectly = false;
          setRevealedExample(null);
        }
        setInputStatus('wrong');
      }
    },
    [currentQuestion, effectiveType, studyMode, autoAdvanceOnCorrect, moveNext]
  );

  const submitChoice = useCallback(
    (isCorrect: boolean) => {
      if (!currentQuestion) return;
      setInputStatus(isCorrect ? 'correct' : 'wrong');
      if (isCorrect && !currentQuestion.isAnsweredCorrectly) {
        currentQuestion.isAnsweredCorrectly = true;
        setStats((s) => ({ correct: s.correct + 1, total: s.total + 1 }));
        // index.html: "Không phát âm khi listen mode"
        // Kiểm tra chặt TẮT → chỉ đọc nguyên từ (bỏ phần chia động từ trong
        // ngoặc, vd "gehen (ging, ist gegangen)" chỉ đọc "gehen"), giống hệt
        // cách speakForMode/các chỗ đọc từ khác trong file này đã làm — chỗ
        // này trước đây luôn đọc y nguyên fullDisplayGerman kể cả khi tắt.
        if (exerciseMode !== 'listen') {
          const reduced = getReducedTarget(currentQuestion.fullDisplayGerman, strictVocabCheck);
          speakText(reduced !== null ? reduced : currentQuestion.fullDisplayGerman);
        }
      } else if (!isCorrect) {
        setStats((s) => ({ ...s, total: s.total + 1 }));
      }
      // Ở chế độ Chọn (MC), đáp án đúng đã bị lộ ra ngay khi chọn (xanh/đỏ)
      // nên không có lý do giữ người dùng lại "thử lại" như chế độ Viết —
      // LUÔN tự động sang câu tiếp theo dù chọn đúng hay sai, KHÔNG phụ
      // thuộc "Chế độ học bài" (chỉ áp dụng kiểu lặp-lại-từ cho chế độ
      // Viết ở onAnswerChange, không áp dụng cho MC) và cũng KHÔNG phụ
      // thuộc cờ "Tự động chuyển câu" (autoAdvanceOnCorrect) — cờ đó chỉ
      // điều khiển chế độ Viết, MC luôn tự chuyển câu.
      setTimeout(moveNext, isCorrect ? 700 : 1100);
    },
    [currentQuestion, exerciseMode, strictVocabCheck, moveNext]
  );

  const toggleCurrentMastered = useCallback(async () => {
    if (!currentQuestion || !user) return;
    if (source === 'merged') {
      const sid = currentQuestion._sessId;
      const wid = currentQuestion._realId ?? currentQuestion.id;
      await toggleMasteredForSession(sid, wid);
    } else {
      toggleMastered(currentQuestion.id);
    }
  }, [currentQuestion, user, source, toggleMastered, toggleMasteredForSession]);

  const toggleCurrentFlagged = useCallback(async () => {
    if (!currentQuestion || !user) return;
    if (source === 'merged') {
      const sid = currentQuestion._sessId;
      const wid = currentQuestion._realId ?? currentQuestion.id;
      await toggleFlaggedForSession(sid, wid);
    } else {
      toggleFlagged(currentQuestion.id);
    }
  }, [currentQuestion, user, source, toggleFlagged, toggleFlaggedForSession]);

  const moveToPrev = useCallback(() => {
    resetInputUI();
    setCurrentIndex((i) => {
      const len = visibleQuestions.length || 1;
      return i <= 0 ? len - 1 : i - 1;
    });
  }, [visibleQuestions.length]);

  // index.html: mobResetBtn click — reload practice list from scratch (reshuffle if random, back to batch 0)
  const resetPractice = useCallback(() => {
    // Đặt về null (không xoá khỏi cache) — đánh dấu "đã đọc xong, không có
    // gì đã lưu", để effect lưu-lại bên dưới vẫn tiếp tục ghi tiến trình
    // mới sau khi reset thay vì bị chặn chờ đọc lại từ AsyncStorage.
    studyStateCacheRef.current.set(studyStateKey, null);
    AsyncStorage.removeItem(studyStateKey).catch(() => {});
    setCurrentIndex(0);
    setBatchIdx(0);
    setMixRound(0);
    setStudyStateLoadTick((t) => t + 1); // buộc effect xây danh sách chạy lại (reshuffle nếu randomMode)
  }, [studyStateKey]);

  // index.html không có khái niệm "batch" chuyển bằng nút riêng — đây là
  // tính năng mới. BUG CŨ: BatchPill gọi thẳng setBatchIdx, không đụng tới
  // currentIndex — nếu đang ở câu #5 của batch cũ rồi bấm sang batch mới,
  // currentIndex=5 giữ nguyên nên hoặc nhảy lung tung giữa batch mới, hoặc
  // vượt quá độ dài batch mới. goToBatch() luôn đưa về câu đầu tiên (index
  // 0) của batch vừa chuyển tới. Đồng thời đưa mixRound về 0 (nguyên từ) —
  // mỗi khi sang batch mới, chế độ Hỗn hợp luôn bắt đầu lại từ lượt "nguyên
  // từ" thay vì tiếp tục lượt đang dang dở của batch cũ.
  const goToBatch = useCallback(
    (idx: number) => {
      resetInputUI();
      const clamped = Math.max(0, Math.min(totalBatches - 1, idx));
      setBatchIdx(clamped);
      setCurrentIndex(0);
      setMixRound(0);
    },
    [totalBatches]
  );

  // "Bỏ qua câu": chỉ được sang câu tiếp theo khi Ô TRẢ LỜI HIỆN TẠI đang
  // đúng, TRỪ KHI công tắc "Cho phép bỏ qua câu" (allowSkip) đang bật — lúc
  // đó cho phép chuyển bất kể đúng/sai.
  // BUG CŨ #1 (đã sửa): điều kiện bị đảo dấu phủ định.
  // BUG CŨ #2 (đã sửa): dùng currentQuestion.isAnsweredCorrectly — cờ này
  // gắn trên Question object và chỉ được set một lần cho CẢ PHIÊN học (để
  // tô viền xanh + tính điểm), không tự tắt khi người dùng XOÁ TRẮNG ô nhập
  // sau khi đã từng trả lời đúng từ đó — khiến "để trống vẫn bỏ qua được"
  // dù allowSkip đang tắt. Dùng inputStatus (phản ánh đúng lượt gõ HIỆN
  // TẠI, luôn reset về 'idle' mỗi khi sang câu mới) thay vì cờ dính đó.
  const skip = useCallback(() => {
    if (studyMode) return; // Chế độ học bài: lặp lại đúng 1 từ, Enter/gửi câu trả lời không chuyển câu.
    if (allowSkip || inputStatus === 'correct') moveNext();
  }, [studyMode, allowSkip, inputStatus, moveNext]);

  // Cho UI biết vì sao skip() không làm gì (để hiện toast/feedback) mà
  // không phải tính lại điều kiện y hệt ở nơi gọi.
  const canSkip = !studyMode && (allowSkip || inputStatus === 'correct');

  return {
    exerciseType,
    setExerciseType,
    exerciseMode,
    setExerciseMode,
    onlyUnmastered,
    setOnlyUnmastered,
    selectedWordIds,
    setSelectedWordIds,
    strictVocabCheck,
    setStrictVocabCheck,
    randomMode,
    setRandomMode,
    autoAdvanceOnCorrect,
    setAutoAdvanceOnCorrect,
    studyMode,
    setStudyMode,
    allowSkip,
    setAllowSkip,
    wordLimit,
    setWordLimit,
    source,
    setSource,
    mergedSessionIds,
    setMergedSessionIds,

    batchIdx,
    setBatchIdx,
    goToBatch,
    totalBatches,

    questions: visibleQuestions,
    totalInPool: questions.length,
    selectionPool,
    currentIndex,
    currentQuestion,
    effectiveType,
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
  };
}

export type PracticeEngine = ReturnType<typeof usePracticeEngine>;
