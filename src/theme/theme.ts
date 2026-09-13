/**
 * Theme tokens — copied 1:1 from index.html
 *   - :root {...}            → dark colors   (index.html ~line 74-110)
 *   - body.light {...}       → light colors  (index.html ~line 113-146)
 *   - @media (max-width:680px) → mobile spacing/sizes (index.html ~line 2061-2480)
 *
 * DO NOT invent new values here. If a new token is needed, go find the exact
 * number in index.html first (search by id/class per the source prompt).
 */

export const colorsDark = {
  bg: '#0d1117',
  bg2: '#161b22',
  bg3: '#1c2333',
  border: '#30363d',
  border2: '#21262d',
  tx: '#e6edf3',
  tx2: '#8b949e',
  tx3: '#6e7681',
  inputBg: '#161b22',
  inputBorder: '#30363d',
  inputColor: '#e6edf3',
  selectBg: '#0d1117',
  btnBg: '#1c2333',
  modalBg: '#161b22',
  modalInputBg: '#0d1117',
} as const;

export const colorsLight = {
  bg: '#f6f8fa',
  bg2: '#ffffff',
  bg3: '#f1f3f5',
  border: '#d0d7de',
  border2: '#e8ecef',
  tx: '#1f2328',
  tx2: '#636c76',
  tx3: '#8c959f',
  inputBg: '#ffffff',
  inputBorder: '#d0d7de',
  inputColor: '#1f2328',
  selectBg: '#ffffff',
  btnBg: '#f1f3f5',
  modalBg: '#ffffff',
  modalInputBg: '#f6f8fa',
} as const;

// Accent colors used throughout the app (logo "TL", mastered/flagged badges, etc.)
export const accent = {
  blue: '#58a6ff', // "TL" in "bei TL", normal prompt tint
  green: '#3fb950', // mastered / correct
  yellow: '#f0c000', // flagged
  gray: '#6e7681', // percent text in stats bar
};

/**
 * 4 trạng thái ô câu hỏi — copy đúng từ --prompt-grd-* / --prompt-border-*
 * getPromptLevel()/_getPromptStateClass() trong index.html map vào các state này.
 * React Native không có CSS gradient trực tiếp trên View background, nên dùng
 * expo-linear-gradient (hoặc react-native-linear-gradient) với các stop dưới đây.
 */
export const promptStates = {
  dark: {
    normal: {
      gradient: ['rgba(88,166,255,0.07)', 'transparent'] as [string, string],
      gradientLocations: [0, 0.55] as [number, number],
      border: '#30363d',
    },
    flagged: {
      gradient: ['rgba(240,192,0,0.13)', 'rgba(240,192,0,0.05)', 'transparent'] as [string, string, string],
      gradientLocations: [0, 0.5, 0.8] as [number, number, number],
      border: 'rgba(240,192,0,0.4)',
    },
    correct: {
      gradient: ['rgba(63,185,80,0.1)', 'transparent'] as [string, string],
      gradientLocations: [0, 0.55] as [number, number],
      border: 'rgba(63,185,80,0.35)',
    },
    mastered: {
      gradient: ['rgba(63,185,80,0.13)', 'rgba(63,185,80,0.05)', 'transparent'] as [string, string, string],
      gradientLocations: [0, 0.5, 0.8] as [number, number, number],
      border: 'rgba(63,185,80,0.5)',
    },
  },
  light: {
    normal: {
      gradient: ['rgba(88,166,255,0.06)', 'transparent'] as [string, string],
      gradientLocations: [0, 0.55] as [number, number],
      border: '#d0d7de',
    },
    flagged: {
      gradient: ['rgba(240,192,0,0.09)', 'rgba(240,192,0,0.03)', 'transparent'] as [string, string, string],
      gradientLocations: [0, 0.5, 0.8] as [number, number, number],
      border: 'rgba(240,192,0,0.45)',
    },
    correct: {
      gradient: ['rgba(63,185,80,0.07)', 'transparent'] as [string, string],
      gradientLocations: [0, 0.55] as [number, number],
      border: 'rgba(63,185,80,0.4)',
    },
    mastered: {
      gradient: ['rgba(63,185,80,0.1)', 'rgba(63,185,80,0.04)', 'transparent'] as [string, string, string],
      gradientLocations: [0, 0.5, 0.8] as [number, number, number],
      border: 'rgba(63,185,80,0.55)',
    },
  },
} as const;

/**
 * Mastered / flagged row tint (word-item list), from:
 *   .word-item.mastered { background: rgba(63,185,80,.07) }
 *   .word-item.flagged  { background: rgba(240,192,0,.13) }
 */
export const wordItemTint = {
  mastered: 'rgba(63,185,80,0.07)',
  flagged: 'rgba(240,192,0,0.13)',
};

/**
 * Mobile spacing/sizing — copied from @media (max-width: 680px) block.
 * All numbers are CSS px from index.html; RN uses density-independent px
 * directly (no conversion needed for React Native's default unit).
 */
export const mobile = {
  headerHeight: 50, // --header-h: 50px (mobile override, desktop is 52px)
  headerPaddingH: 12,
  mobileMenuBtnSize: 36,
  mobileMenuBtnRadius: 7,
  drawerWidthPercent: 0.88, // 88vw
  overlayOpacity: 0.55,
  overlayAnimMs: 250,

  statsBarPaddingV: 6,
  statsBarPaddingH: 12,

  batchPillBottom: 18, // + safe-area-bottom
  batchPillRight: 18,
  batchPillRadius: 12,

  wordItemRadius: 8,
  wordItemGap: 4,
  wordItemMainMinHeight: 50,
  wordItemCheckboxSize: 17,
  wordItemGermanSize: 14.4, // 0.9rem * 16
  wordItemMeaningSize: 12.16, // 0.76rem * 16
  wordExpandBtnSize: 30,

  exerciseAreaPaddingV: 12,
  exerciseAreaPaddingH: 10,
  exPromptRadius: 10,
  exPromptPaddingV: 13,
  exPromptPaddingH: 12,
  exQuestionSize: 18.4, // 1.15rem * 16
  answerInputSize: 16, // 1rem * 16
  answerInputPadding: 12,
  exBtnFontSize: 11.84, // 0.74rem * 16
  exBtnMinHeight: 38,
  mcOptionMinHeight: 50,
  mcOptionFontSize: 14.08, // 0.88rem * 16

  modalRadiusTop: 16,
  modalMaxHeightPercent: 0.9,

  toastFontSize: 12.16, // 0.76rem * 16
  toastMaxWidthPercent: 0.84,

  touchAnimMs: 175, // (hover:none) -> lighter opacity/transform transitions ~0.15-0.2s
};

export const fonts = {
  mono: 'DM Mono', // stats bar numbers — must bundle DM Mono via expo-font
};

export type ThemeColors = typeof colorsDark;
