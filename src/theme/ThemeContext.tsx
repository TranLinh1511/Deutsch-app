import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorsDark, colorsLight, promptStates, ThemeColors } from './theme';

type Mode = 'dark' | 'light';

interface ThemeContextValue {
  mode: Mode;
  colors: ThemeColors;
  prompt: typeof promptStates.dark;
  toggleMode: () => void;
  setMode: (m: Mode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Key mirrors localStorage key used for dark/light persistence in index.html
const STORAGE_KEY = 'beitl_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Original app defaults to dark (no `light` class on <body> until toggled)
  const [mode, setModeState] = useState<Mode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setModeState(saved);
    });
  }, []);

  const setMode = (m: Mode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m);
  };

  const toggleMode = () => setMode(mode === 'dark' ? 'light' : 'dark');

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === 'dark' ? colorsDark : colorsLight,
      prompt: promptStates[mode],
      toggleMode,
      setMode,
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
