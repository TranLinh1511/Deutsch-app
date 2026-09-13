export interface BulkWordDraft {
  originalGerman: string;
  mainGerman: string;
  wordType: string;
  meaning: string;
  example: string;
}

export interface BulkParseError {
  line: number;
  raw: string;
  reason: string;
}

export interface BulkParseResult {
  words: BulkWordDraft[];
  errors: BulkParseError[];
}

/**
 * Modal "Thêm từ mới" › tab "Hàng loạt": mỗi dòng là 1 từ, các trường cách
 * nhau bởi TAB (dán trực tiếp từ Excel/Google Sheets) theo thứ tự:
 *   từ [tab] loại [tab] nghĩa [tab] ví dụ (tuỳ chọn)
 * Nếu dòng không có ký tự tab (gõ tay), cho phép dùng 2+ khoảng trắng liên
 * tiếp làm dấu phân cách để dễ dùng hơn trên mobile.
 */
export function parseBulkWordText(text: string): BulkParseResult {
  const words: BulkWordDraft[] = [];
  const errors: BulkParseError[] = [];

  text
    .split('\n')
    .map((raw, idx) => ({ raw, lineNo: idx + 1 }))
    .filter(({ raw }) => raw.trim().length > 0)
    .forEach(({ raw, lineNo }) => {
      const parts = (raw.includes('\t') ? raw.split('\t') : raw.split(/ {2,}/)).map((p) => p.trim());

      const [german, wordType = '', meaning = '', example = ''] = parts;

      if (!german) {
        errors.push({ line: lineNo, raw, reason: 'Thiếu từ tiếng Đức' });
        return;
      }
      if (!meaning) {
        errors.push({ line: lineNo, raw, reason: 'Thiếu nghĩa tiếng Việt' });
        return;
      }

      words.push({
        originalGerman: german,
        mainGerman: german.split('/')[0].trim(),
        wordType: wordType.trim(),
        meaning: meaning.trim(),
        example: example.trim(),
      });
    });

  return { words, errors };
}
