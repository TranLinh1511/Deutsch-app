import type { Question, ExerciseMode, ExerciseType } from './questionBuilder';
import { getVietnameseExample } from './grading';

export interface PromptDisplay {
  typeTag: string;
  mainText: string;
}

type EffType = Exclude<ExerciseType, 'mixedRandom'>;

/** index.html: the big if/else building `typeTag` + `prompt` text (~line 7990-8025) */
export function buildPromptDisplay(
  q: Question,
  effType: EffType,
  exerciseType: ExerciseType,
  exerciseMode: ExerciseMode
): PromptDisplay {
  const mixedPrefix = exerciseType === 'mixedRandom' ? 'Hỗn hợp · ' : '';

  if (exerciseMode === 'listen') {
    if (effType === 'fullWord') {
      // Nghe - nguyên từ: phát âm thanh đọc NGHĨA (tiếng Việt), người dùng
      // gõ lại NGUYÊN TỪ tiếng Đức — không hiện chữ để không lộ đáp án.
      return { typeTag: 'Nghe nghĩa → Viết nguyên từ', mainText: 'Nghe và viết nguyên từ tiếng Đức…' };
    }
    if (effType === 'fullMeaning') {
      // Nghe - nghĩa: phát âm thanh đọc NGUYÊN TỪ (tiếng Đức), người dùng
      // gõ lại NGHĨA tiếng Việt.
      return { typeTag: 'Nghe nguyên từ → Viết nghĩa', mainText: 'Nghe và viết nghĩa tiếng Việt…' };
    }
    // fullSentence
    return {
      typeTag: 'Nghe câu ví dụ → Viết lại',
      mainText: getVietnameseExample(q.example) || q.meaning,
    };
  }

  if (exerciseMode === 'speak') {
    // Chế độ "Phát âm": đề bài hiển thị y hệt chế độ Viết (không đọc thay
    // như "Nghe"), chỉ khác cách trả lời là NÓI thay vì gõ chữ.
    if (effType === 'fullWord') {
      return { typeTag: mixedPrefix ? `${mixedPrefix}Lượt Nói nguyên từ` : 'Nói nguyên từ', mainText: `"${q.meaning}"` };
    }
    if (effType === 'fullMeaning') {
      return { typeTag: mixedPrefix ? `${mixedPrefix}Lượt Nói nghĩa` : 'Nói nghĩa', mainText: `"${q.fullDisplayGerman}"` };
    }
    return {
      typeTag: mixedPrefix ? `${mixedPrefix}Lượt Nói câu` : 'Nói câu ví dụ',
      mainText: `"${getVietnameseExample(q.example) || q.meaning}"`,
    };
  }

  if (effType === 'fullWord') {
    return {
      typeTag: mixedPrefix ? `${mixedPrefix}Lượt Nguyên từ` : 'Nhập nguyên từ',
      mainText: `"${q.meaning}"`,
    };
  }
  if (effType === 'fullMeaning') {
    return {
      typeTag: mixedPrefix ? `${mixedPrefix}Lượt Nghĩa` : 'Nhập nghĩa',
      mainText: `"${q.fullDisplayGerman}"`,
    };
  }
  // fullSentence
  const modeLabel = exerciseMode === 'choose' ? 'Chọn câu ví dụ' : 'Nhập câu ví dụ';
  return {
    typeTag: mixedPrefix ? `${mixedPrefix}Lượt ${exerciseMode === 'choose' ? 'Chọn câu' : 'Nhập câu'}` : modeLabel,
    mainText: `"${getVietnameseExample(q.example) || q.meaning}"`,
  };
}
