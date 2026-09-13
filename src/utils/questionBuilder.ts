import type { VocabWord } from '@/types/models';
import { shuffleArray } from './grading';

export type ExerciseType = 'fullWord' | 'fullMeaning' | 'fullSentence' | 'mixedRandom';
export type ExerciseMode = 'write' | 'choose' | 'listen' | 'speak';

/** index.html: the object shape pushed into currentQuestionsList by buildFullList() */
export interface Question {
  id: string;
  _sessId: string;
  _realId?: string; // only set in merged mode: id is "sid:realId", _realId is the actual word id
  fullDisplayGerman: string;
  mainGerman: string;
  meaning: string;
  wordType: string;
  example: string;
  isAnsweredCorrectly: boolean;
  isMastered: boolean;
  isFlagged: boolean;
}

/**
 * index.html: buildFullList() when currentSource === "merged" — combines
 * vocab from several sessions, composite id "sid:realId" so mastered/
 * flagged toggles can be routed back to the correct session+word.
 */
/**
 * Sync variant of buildMergedQuestionList — builds the composite question
 * list straight from an already-fetched combined vocab pool (DataStore's
 * mergedVocab/mergedMasteredIds/mergedFlaggedIds), instead of re-fetching
 * per session. Keeps the practice engine, sidebar and "Chọn từ luyện tập"
 * modal all reading from the same combined data.
 */
export function buildMergedQuestionListFromPool(
  mergedVocab: (VocabWord & { _sessId: string })[],
  mergedMasteredIds: Set<string>,
  mergedFlaggedIds: Set<string>,
  includeMastered: boolean
): Question[] {
  return mergedVocab
    .filter((item) => includeMastered || !mergedMasteredIds.has(item.id))
    .map((item) => ({
      id: item._sessId + ':' + item.id,
      _realId: item.id,
      _sessId: item._sessId,
      fullDisplayGerman: item.originalGerman,
      mainGerman: item.mainGerman || item.originalGerman,
      meaning: item.meaning,
      wordType: item.wordType || '',
      example: item.example || '',
      isAnsweredCorrectly: false,
      isMastered: mergedMasteredIds.has(item.id),
      isFlagged: mergedFlaggedIds.has(item.id),
    }));
}

export async function buildMergedQuestionList(
  uid: string,
  sessionIds: string[],
  includeMastered: boolean,
  fetchers: {
    getVocab: (uid: string, sid: string) => Promise<VocabWord[]>;
    getMastered: (uid: string, sid: string) => Promise<Set<string>>;
    getFlagged: (uid: string, sid: string) => Promise<Set<string>>;
  }
): Promise<Question[]> {
  const combined: Question[] = [];
  for (const sid of sessionIds) {
    const [vocab, mIds, fIds] = await Promise.all([
      fetchers.getVocab(uid, sid),
      fetchers.getMastered(uid, sid),
      fetchers.getFlagged(uid, sid),
    ]);
    vocab.forEach((item) => {
      if (!includeMastered && mIds.has(item.id)) return;
      combined.push({
        id: sid + ':' + item.id,
        _realId: item.id,
        _sessId: sid,
        fullDisplayGerman: item.originalGerman,
        mainGerman: item.mainGerman || item.originalGerman,
        meaning: item.meaning,
        wordType: item.wordType || '',
        example: item.example || '',
        isAnsweredCorrectly: false,
        isMastered: mIds.has(item.id),
        isFlagged: fIds.has(item.id),
      });
    });
  }
  return combined;
}

/** index.html: buildFullList(includeMastered) — session-only version (the
 * "merged" multi-session variant is deferred; see PracticeScreen notes).
 */
export function buildQuestionList(
  vocab: VocabWord[],
  masteredIds: Set<string>,
  flaggedIds: Set<string>,
  sessId: string,
  includeMastered: boolean
): Question[] {
  return vocab
    .filter((item) => includeMastered || !masteredIds.has(item.id))
    .map((item) => ({
      id: item.id,
      _sessId: sessId,
      fullDisplayGerman: item.originalGerman,
      mainGerman: item.mainGerman || item.originalGerman,
      meaning: item.meaning,
      wordType: item.wordType || '',
      example: item.example || '',
      isAnsweredCorrectly: false,
      isMastered: masteredIds.has(item.id),
      isFlagged: flaggedIds.has(item.id),
    }));
}

/** index.html: getEffectiveType(q) — mixedRandom alternates fullWord/fullMeaning per round */
export function getEffectiveType(exerciseType: ExerciseType, mixRound: number): Exclude<ExerciseType, 'mixedRandom'> {
  if (exerciseType === 'mixedRandom') {
    return (['fullWord', 'fullMeaning'] as const)[mixRound] || 'fullWord';
  }
  return exerciseType;
}

export interface Choice {
  text: string;
  isCorrect: boolean;
}

/** index.html: generateChoices(q, allList) — builds the 4 MC options */
export function generateChoices(
  q: Question,
  allList: Question[],
  effType: Exclude<ExerciseType, 'mixedRandom'>,
  exerciseMode: ExerciseMode
): Choice[] {
  let correctAnswer: string;
  let wrongPool: string[];

  if (effType === 'fullWord') {
    // "nghe - nguyên từ" (listen mode) vẫn nhắm tới NGUYÊN TỪ giống hệt
    // chế độ viết/chọn thường — chỉ khác ở chỗ đề bài được ĐỌC (nghĩa)
    // thay vì hiện chữ. Không đảo mục tiêu theo exerciseMode nữa.
    correctAnswer = q.fullDisplayGerman;
    wrongPool = allList.filter((i) => i.id !== q.id).map((i) => i.fullDisplayGerman);
  } else if (effType === 'fullMeaning') {
    correctAnswer = q.meaning;
    wrongPool = allList.filter((i) => i.id !== q.id).map((i) => i.meaning);
  } else {
    // fullSentence
    correctAnswer = q.example;
    wrongPool = allList.filter((i) => i.id !== q.id && i.example).map((i) => i.example);
  }

  const shuffledWrong = shuffleArray([...new Set(wrongPool)]);
  return shuffleArray([correctAnswer, ...shuffledWrong.slice(0, 3)].slice(0, 4)).map((c) => ({
    text: c,
    isCorrect: c === correctAnswer,
  }));
}
