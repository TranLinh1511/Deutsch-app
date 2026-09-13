/**
 * Tokens specific to the auth screens (Login.html), separate from
 * theme.ts (index.html) because Login.html defines its own --red/--gold
 * accents not present in the main app's root variables.
 */
export const authColors = {
  blue: '#58a6ff',
  green: '#3fb950',
  red: '#f78166',
  gold: '#f0c000',
};

export const fonts = {
  // NOTE: bundle via expo-font (useFonts) in App.tsx before relying on this,
  // e.g. 'DM Mono': require('assets/fonts/DMMono-Regular.ttf'). Falls back to
  // system monospace until then.
  mono: 'DM Mono',
  brand: 'Syne', // .brand font-family
};

export const authLayout = {
  cardRadius: 16,
  cardPaddingTop: 36,
  cardPaddingH: 32,
  cardPaddingBottom: 28,
  fieldGap: 15,
  buttonRadius: 9,
  buttonPaddingV: 13,
  errBoxRadius: 7,
  errBoxFontSize: 12.48, // 0.78rem
  taglineFontSize: 11.52, // 0.72rem
  brandFontSize: 21.6, // 1.35rem
  flagFontSize: 33.6, // 2.1rem
};
