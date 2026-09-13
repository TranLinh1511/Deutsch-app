import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { mobile } from '@/theme/theme';
import type { Choice } from '@/utils/questionBuilder';

interface MCOptionsProps {
  choices: Choice[];
  onSelect: (isCorrect: boolean) => void;
  disabled: boolean;
  resetKey: string; // change (e.g. question id) to reset selection state
}

const LETTERS = ['A', 'B', 'C', 'D'];

/** index.html: .mc-options / .mc-option — reveal correct(green)/wrong(red) after tap, then lock */
function MCOptions({ choices, onSelect, disabled, resetKey }: MCOptionsProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [resetKey]);

  function handlePress(i: number, choice: Choice) {
    if (selected !== null || disabled) return;
    setSelected(i);
    onSelect(choice.isCorrect);
  }

  return (
    <View style={styles.grid}>
      {choices.map((c, i) => {
        const isRevealed = selected !== null;
        const isThisCorrect = c.isCorrect;
        const isThisSelected = selected === i;
        let bg = colors.bg3;
        let borderColor = colors.border;
        let textColor = colors.tx;
        if (isRevealed && isThisCorrect) {
          bg = 'rgba(63,185,80,0.15)';
          borderColor = '#3fb950';
          textColor = '#3fb950';
        } else if (isRevealed && isThisSelected && !isThisCorrect) {
          bg = 'rgba(247,129,102,0.15)';
          borderColor = '#f78166';
          textColor = '#f78166';
        }
        return (
          <Pressable
            key={i}
            onPress={() => handlePress(i, c)}
            disabled={isRevealed}
            style={[styles.option, { backgroundColor: bg, borderColor }]}
          >
            <View style={[styles.letter, { borderColor }]}>
              <Text style={{ color: textColor, fontSize: 11.5, fontWeight: '700' }}>{LETTERS[i]}</Text>
            </View>
            <Text style={[styles.optionText, { color: textColor }]} numberOfLines={2}>
              {c.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default React.memo(MCOptions);

const styles = StyleSheet.create({
  grid: { gap: 8, marginTop: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: mobile.mcOptionMinHeight,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  letter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { fontSize: mobile.mcOptionFontSize, flex: 1 },
});
