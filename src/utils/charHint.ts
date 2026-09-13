import { normalizeChar } from './grading';

export type CharState = 'ok' | 'bad' | 'pending' | 'skip';
export interface HintChar {
  ch: string;
  state: CharState;
}

const SPECIAL_RE = /^[\/.';!?,:\-()[\]{}]$/;
const PUNCT_RE = /[().,[\]{};:'"!?]/;

/**
 * index.html: buildCharHint(userRaw, correctRaw) — ported 1:1 (~line
 * 4393-4535). Returns a per-character state list instead of an HTML
 * string, since RN renders with <Text> spans rather than innerHTML.
 *
 * Splits the target into a MAIN region (before the first "(") compared
 * char-by-char including spaces, and a PAREN region (conjugation/plural
 * hints in parens) compared ignoring punctuation — so a missing comma or
 * bracket in the parenthetical never counts as a mistake. Once the first
 * mismatch is hit, every character after it is "pending" (not "bad") —
 * only the FIRST wrong character is actually flagged.
 */
export function buildCharHint(userRaw: string, correctRaw: string): HintChar[] {
  const parenStart = correctRaw.indexOf('(');
  const mainRaw = parenStart >= 0 ? correctRaw.slice(0, parenStart) : correctRaw;
  const parenRaw = parenStart >= 0 ? correctRaw.slice(parenStart) : '';

  const stripMiddot = (s: string) => s.replace(/·/g, '');
  const stripSpecialCollapse = (s: string) =>
    s
      .replace(/\s*[\/.';!?,:\-()[\]{}]\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const mainCorrectRaw = stripMiddot(mainRaw).split('');
  const userStripped = stripSpecialCollapse(userRaw);
  const userFull = userStripped.split('').map(normalizeChar);

  const correctStripped = stripSpecialCollapse(stripMiddot(mainRaw));
  const correctCmp = correctStripped.split('').map(normalizeChar);

  const cmpState: ('ok' | 'bad' | 'pending')[] = [];
  let hitBad = false;
  for (let i = 0; i < correctCmp.length; i++) {
    if (hitBad) {
      cmpState.push('pending');
      continue;
    }
    if (i >= userFull.length) {
      cmpState.push('pending');
      continue;
    }
    if (userFull[i] === correctCmp[i]) cmpState.push('ok');
    else {
      cmpState.push('bad');
      hitBad = true;
    }
  }

  const mainState: CharState[] = [];
  {
    let ci = 0;
    let prevSkipped = false;
    for (let i = 0; i < mainCorrectRaw.length; i++) {
      const ch = mainCorrectRaw[i];
      if (SPECIAL_RE.test(ch)) {
        mainState.push('skip');
        prevSkipped = true;
        continue;
      }
      if (ch === ' ' && prevSkipped) {
        mainState.push('skip');
        prevSkipped = false;
        continue;
      }
      prevSkipped = false;
      mainState.push(cmpState[ci] || 'pending');
      ci++;
    }
  }

  const ui = Math.min(correctCmp.length, userFull.length);
  const userRest = hitBad ? '' : userStripped.slice(ui);

  const stripPunct = (s: string) =>
    s
      .replace(/[().,[\]{};:'"!?]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const parenCmp = stripMiddot(stripPunct(parenRaw)).split('').map(normalizeChar);
  const userRestCmp = stripPunct(userRest).split('').map(normalizeChar);

  const parenState: ('ok' | 'bad' | 'pending')[] = [];
  for (let i = 0; i < parenCmp.length; i++) {
    if (hitBad) {
      parenState.push('pending');
      continue;
    }
    if (i >= userRestCmp.length) {
      parenState.push('pending');
      continue;
    }
    if (userRestCmp[i] === parenCmp[i]) parenState.push('ok');
    else {
      parenState.push('bad');
      hitBad = true;
    }
  }

  const result: HintChar[] = [];

  let mi = 0;
  for (const ch of mainRaw) {
    if (ch === '·') continue;
    const state = mainState[mi] || 'pending';
    mi++;
    result.push({ ch, state: state === 'skip' ? 'ok' : state });
  }

  if (parenRaw) {
    let pi = 0;
    let lastParenState: CharState = hitBad && parenState.length === 0 ? 'bad' : 'pending';
    for (const ch of stripMiddot(parenRaw)) {
      if (PUNCT_RE.test(ch)) {
        result.push({ ch, state: lastParenState });
      } else {
        const state = parenState[pi] || 'pending';
        lastParenState = state;
        pi++;
        result.push({ ch, state });
      }
    }
  }

  return result;
}
