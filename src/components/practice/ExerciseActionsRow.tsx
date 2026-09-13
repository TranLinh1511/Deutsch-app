import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { mobile } from '@/theme/theme';
import Icon, { IconProps } from '@/components/Icon';

interface ExerciseActionsRowProps {
  onToggleHint: () => void;
  hintVisible: boolean;
  isFlagged: boolean;
  onToggleFlag: () => void;
  onEdit: () => void;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * index.html: #exBtnsRow — 💡 Gợi ý, ⭐/☆ Chú ý, ✏️ Sửa, then ⏮/⏭ pushed to
 * the right via margin-left:auto on ⏮. FIXED BUG from the last build: a
 * horizontal ScrollView with no explicit height + default `alignItems:
 * 'stretch'` let each button stretch to fill the parent's leftover
 * vertical space (looked like tall vertical bars instead of a compact
 * pill row). Fixed here with a plain non-scrolling row
 * (`flexWrap: 'nowrap'`, `alignItems: 'center'`, `flexShrink: 0` on each
 * button) since 5 short buttons fit one row without needing to scroll.
 */
// React.memo — tránh vẽ lại hàng nút này theo từng ký tự gõ ở ô trả lời
// (xem giải thích chi tiết trong ExercisePromptCard.tsx). Cần MainScreen
// truyền các hàm onXxx bằng useCallback để tham chiếu không đổi mỗi render.
function ExerciseActionsRow({
  onToggleHint,
  hintVisible,
  isFlagged,
  onToggleFlag,
  onEdit,
  onPrev,
  onNext,
}: ExerciseActionsRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <ExBtn label={hintVisible ? 'Ẩn gợi ý' : 'Gợi ý'} icon="lightbulb" onPress={onToggleHint} color={colors.tx} bg={colors.bg3} />
      <ExBtn
        label={isFlagged ? 'Bỏ chú ý' : 'Chú ý'}
        icon="star"
        iconSolid={!isFlagged}
        onPress={onToggleFlag}
        color={isFlagged ? colors.tx2 : '#f0c000'}
        bg={colors.bg3}
      />
      <ExBtn label="Sửa" icon="edit" onPress={onEdit} color="#d2a8ff" bg={colors.bg3} borderColor="rgba(210,168,255,0.4)" />
      <View style={{ flex: 1 }} />
      <ExBtn icon="step-backward" onPress={onPrev} color="#58a6ff" bg={colors.bg3} borderColor="rgba(88,166,255,0.3)" compact iconOnly />
      <ExBtn icon="step-forward" onPress={onNext} color="#58a6ff" bg={colors.bg3} borderColor="rgba(88,166,255,0.3)" compact iconOnly />
    </View>
  );
}

export default React.memo(ExerciseActionsRow);

function ExBtn({
  label,
  onPress,
  color,
  bg,
  borderColor,
  compact,
  icon,
  iconSolid = true,
  iconOnly = false,
}: {
  label?: string;
  onPress: () => void;
  color: string;
  bg: string;
  borderColor?: string;
  compact?: boolean;
  icon?: IconProps['name'];
  iconSolid?: boolean;
  iconOnly?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: borderColor || colors.border,
          paddingHorizontal: compact ? 14 : 10,
        },
      ]}
    >
      {iconOnly && icon ? (
        <Icon name={icon} size={13} color={color} solid={iconSolid} />
      ) : (
        <Text style={{ color, fontSize: mobile.exBtnFontSize, fontWeight: '600' }} numberOfLines={1}>
          {icon ? (
            <>
              <Icon name={icon} size={11} color={color} solid={iconSolid} />{'  '}
            </>
          ) : null}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 6,
    paddingVertical: 12,
  },
  btn: {
    borderWidth: 1,
    borderRadius: 8,
    height: mobile.exBtnMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
