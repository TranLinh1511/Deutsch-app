import type { Question, ExerciseMode, ExerciseType } from './questionBuilder';
import { buildCharHint, type HintChar } from './charHint';

type EffType = Exclude<ExerciseType, 'mixedRandom'>;

export type HintContent = { kind: 'text'; text: string } | { kind: 'chars'; chars: HintChar[] };

/**
 * index.html: hintBtn click handler (~line 8220-8248), ĐÃ SỬA 2 lần:
 *  1) Trước đây chế độ Nghe bấm "Gợi ý" chỉ hiện thẳng cả đáp án dạng chữ
 *     (từ + nghĩa + câu ví dụ), không khớp với những gì người dùng đã gõ.
 *     Giờ chế độ Nghe (trừ fullSentence, vẫn hiện câu mẫu dạng chữ) dùng
 *     CHUNG kiểu gợi ý theo từng ký tự (buildCharHint) như chế độ Viết.
 *  2) BỊ NGƯỢC: target lúc đó tính theo exerciseMode (đảo ngược riêng cho
 *     'listen'), trong khi effType đã tự nó nói rõ đang gõ gì rồi — y hệt
 *     logic chấm điểm THẬT ở usePracticeEngine.onAnswerChange (fullWord
 *     LUÔN nhắm nguyên từ tiếng Đức, fullMeaning LUÔN nhắm nghĩa tiếng
 *     Việt, không phụ thuộc exerciseMode). Vì đảo ngược nhầm, ở "Nghe
 *     nguyên từ → Viết nghĩa" (đề đã ĐỌC nguyên từ ra rồi) gợi ý lại hiện
 *     đúng nguyên từ đó — vô nghĩa vì đó là thứ người dùng vừa nghe, không
 *     phải thứ họ đang cần gõ. Bỏ hẳn phần rẽ theo exerciseMode, chỉ dùng
 *     effType — khớp đúng những gì người dùng thực sự đang phải gõ.
 */
export function buildHintContent(
  q: Question,
  effType: EffType,
  exerciseMode: ExerciseMode,
  typedValue: string
): HintContent {
  if (effType === 'fullSentence') {
    return {
      kind: 'text',
      text: q.example
        ? `Câu ví dụ: ${q.example}`
        : `Chưa có câu mẫu — câu phải chứa từ: ${q.mainGerman || q.fullDisplayGerman}`,
    };
  }

  const target = effType === 'fullMeaning' ? q.meaning : q.fullDisplayGerman;

  return { kind: 'chars', chars: buildCharHint(typedValue, target) };
}
