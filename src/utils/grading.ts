/**
 * Grading engine — ported 1:1 from index.html's normalization + matching
 * functions (~line 4279-4356, 6800-6822). This is the most safety-critical
 * part to keep faithful: any change here changes what counts as "correct".
 */

// index.html: _viMap — strips Vietnamese diacritics for lenient meaning matching
const VI_MAP: Record<string, string> = {
  á: 'a', à: 'a', ả: 'a', ã: 'a', ạ: 'a', ă: 'a', ắ: 'a', ằ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a',
  â: 'a', ấ: 'a', ầ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a', đ: 'd',
  é: 'e', è: 'e', ẻ: 'e', ẽ: 'e', ẹ: 'e', ê: 'e', ế: 'e', ề: 'e', ể: 'e', ễ: 'e', ệ: 'e',
  í: 'i', ì: 'i', ỉ: 'i', ĩ: 'i', ị: 'i',
  ó: 'o', ò: 'o', ỏ: 'o', õ: 'o', ọ: 'o', ô: 'o', ố: 'o', ồ: 'o', ổ: 'o', ỗ: 'o', ộ: 'o',
  ơ: 'o', ớ: 'o', ờ: 'o', ở: 'o', ỡ: 'o', ợ: 'o',
  ú: 'u', ù: 'u', ủ: 'u', ũ: 'u', ụ: 'u', ư: 'u', ứ: 'u', ừ: 'u', ử: 'u', ữ: 'u', ự: 'u',
  ý: 'y', ỳ: 'y', ỷ: 'y', ỹ: 'y', ỵ: 'y',
};

export function normalizeChar(c: string): string {
  const l = c.toLowerCase();
  return VI_MAP[l] || l;
}

/** index.html: normalizeVi(s) — for Vietnamese meaning matching (accent-insensitive) */
export function normalizeVi(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .split('')
    .map(normalizeChar)
    .join('')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** index.html: isMeaningMatch(u, c) */
export function isMeaningMatch(u: string, c: string): boolean {
  return normalizeVi(u) === normalizeVi(c);
}

/** index.html: normSearch(s) — used for sidebar/global search, not grading */
export function normSearch(s: string): string {
  return (s || '').toLowerCase().replace(/·/g, '');
}

/** index.html: normForCheck(s) — for German word matching (case/punct-insensitive) */
export function normForCheck(s: string): string {
  return s
    .replace(/[\/<>(),\-[\]+·]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * index.html: normNoMiddot(s) — strips "·" WITHOUT adding a space, so
 * separable verbs typed solid match the middot form, e.g.
 * "mitkommen" === "mit·kommen".
 */
export function normNoMiddot(s: string): string {
  return s
    .replace(/·/g, '')
    .replace(/[\/<>(),\-[\]+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** index.html: isSmartMatch(u, c) */
export function isSmartMatch(u: string, c: string): boolean {
  if (normForCheck(u) === normForCheck(c)) return true;
  if (normNoMiddot(u) === normNoMiddot(c)) return true;
  return false;
}

/** index.html: isOriginalWordMatch — alias, used in listen mode */
export const isOriginalWordMatch = isSmartMatch;

/** index.html: normSentence(s) — strips trailing "(...)" translation + punctuation */
export function normSentence(s: string): string {
  return (s || '')
    .replace(/\(.*?\)\s*$/, '')
    .trim()
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** index.html: isSentenceMatch(u, c) */
export function isSentenceMatch(u: string, c: string): boolean {
  if (!c) return false;
  return normSentence(u) === normSentence(c);
}

/** index.html: getGermanExample(example) — strips trailing "(nghĩa tiếng Việt)" */
export function getGermanExample(example: string): string {
  return (example || '').replace(/\(.*?\)\s*$/, '').trim();
}

/** index.html: getVietnameseExample(example) — extracts the trailing "(...)" */
export function getVietnameseExample(example: string): string {
  const m = (example || '').match(/\(([^()]*)\)\s*$/);
  return m ? m[1].trim() : '';
}

/**
 * index.html: getReducedTarget(q) — when strictVocabCheck is OFF, verbs/words
 * with a "(...)" suffix (e.g. conjugation hints) only require the part
 * before "(" to be typed.
 */
export function getReducedTarget(fullDisplayGerman: string, strictVocabCheck: boolean): string | null {
  if (!strictVocabCheck) {
    const parenIdx = fullDisplayGerman.indexOf('(');
    if (parenIdx >= 0) {
      return fullDisplayGerman.slice(0, parenIdx).trim() || null;
    }
  }
  return null;
}

/** index.html: checkWriteAnswer(val, q) */
export function checkWriteAnswer(val: string, fullDisplayGerman: string, strictVocabCheck: boolean): boolean {
  const reduced = getReducedTarget(fullDisplayGerman, strictVocabCheck);
  if (reduced !== null) return isSmartMatch(val, reduced);
  return isSmartMatch(val, fullDisplayGerman);
}

/**
 * Danh từ có dạng "das Mittel / die Mittel" (số ít / số nhiều, phân cách
 * bằng "/") — cắt lấy phần SỐ ÍT (trước dấu "/"). Dùng riêng cho chế độ
 * luyện "Phát âm" (nói nguyên từ): chỉ yêu cầu người dùng đọc đúng dạng số
 * ít, không bắt đọc luôn cả số nhiều. Áp dụng SAU getReducedTarget (vẫn
 * tôn trọng "Kiểm tra chặt" cho phần chia động từ trong ngoặc).
 */
export function getSpeakWordTarget(fullDisplayGerman: string, strictVocabCheck: boolean): string {
  const reduced = getReducedTarget(fullDisplayGerman, strictVocabCheck) ?? fullDisplayGerman;
  const slashIdx = reduced.indexOf('/');
  return slashIdx > -1 ? reduced.slice(0, slashIdx).trim() : reduced;
}

/** index.html: checkSpeakWordAnswer — như checkWriteAnswer nhưng cho phép
 * khớp CHỈ với dạng số ít của danh từ có "/" (xem getSpeakWordTarget). */
export function checkSpeakWordAnswer(val: string, fullDisplayGerman: string, strictVocabCheck: boolean): boolean {
  return isSmartMatch(val, getSpeakWordTarget(fullDisplayGerman, strictVocabCheck));
}

/**
 * Gộp wordType tự do (n, n (Pl.), v, adj, adv, other...) về 1 trong 3 nhóm:
 * 'n' | 'v' | 'other'. Cùng logic với bản trước đó từng lặp lại riêng ở
 * BulkSelectModal.tsx và SidebarDrawer.tsx — giờ dùng chung từ đây để
 * useListenMode cũng nhận diện được từ nào là động từ.
 */
export function classifyWordType(wordType: string | undefined): 'n' | 'v' | 'other' {
  const t = (wordType || '').trim().toLowerCase();
  if (!t) return 'other';
  if (t.startsWith('n') || t.includes('danh')) return 'n';
  if (t.startsWith('v') || t.includes('động')) return 'v';
  return 'other';
}

/** index.html: shuffleArray (Fisher-Yates) */
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
