import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { mobile, wordItemTint, accent } from '@/theme/theme';
import { speakText } from '@/services/tts';
import Icon from './Icon';
import type { VocabWord } from '@/types/models';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Mobile .word-item card (index.html ~line 6256):
 *  - main row (.word-item-main): checkbox 17x17, German word 0.9rem bold,
 *    meaning 0.76rem below, status badge on the right
 *  - .word-expand-btn (•••, 30x30) toggles an accordion action row below
 *    the card (edit / master / flag / delete) — .word-item-actions-row
 *  - mastered -> bg tint rgba(63,185,80,.07); flagged -> rgba(240,192,0,.13)
 */
interface WordItemCardProps {
  word: VocabWord;
  isMastered: boolean;
  isFlagged: boolean;
  isBulkMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onToggleMastered: () => void;
  onToggleFlagged: () => void;
  onDelete: () => void;
  /** Tên phiên chứa từ này — chỉ truyền khi đang ở chế độ "Gộp phiên", để
   * phân biệt từ vựng đến từ phiên nào trong danh sách gộp. */
  sessionLabel?: string;
}

export default function WordItemCard({
  word,
  isMastered,
  isFlagged,
  isBulkMode,
  isSelected,
  onToggleSelect,
  onEdit,
  onToggleMastered,
  onToggleFlagged,
  onDelete,
  sessionLabel,
}: WordItemCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const tint = isMastered ? wordItemTint.mastered : isFlagged ? wordItemTint.flagged : undefined;
  const badge = isMastered ? { icon: 'check-circle' as const, label: 'thuộc', color: accent.green } : isFlagged
    ? { icon: 'star' as const, label: 'chú ý', color: accent.yellow }
    : null;

  return (
    <View style={[styles.card, { borderColor: colors.border2, backgroundColor: tint ?? colors.bg2 }]}>
      <Pressable
        style={styles.main}
        onPress={() => {
          if (isBulkMode) {
            onToggleSelect();
          } else {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpanded((e) => !e);
          }
        }}
      >
        {isBulkMode && (
          <View
            style={[
              styles.checkbox,
              { borderColor: colors.border, backgroundColor: isSelected ? accent.blue : 'transparent' },
            ]}
          >
            {isSelected && <Icon name="check" size={9} color="#fff" />}
          </View>
        )}

        <View style={styles.textCol}>
          <Pressable onPress={() => speakText(word.originalGerman)} hitSlop={4}>
            <Text numberOfLines={1} style={[styles.german, { color: colors.tx }]}>
              <Icon name="volume-up" size={12} color={colors.tx} />{'  '}{word.originalGerman}
              {word.wordType ? <Text style={[styles.typeBadge, { color: colors.tx3 }]}> {word.wordType}</Text> : null}
            </Text>
          </Pressable>
          <Text numberOfLines={1} style={[styles.meaning, { color: colors.tx3 }]}>
            {word.meaning}
            {sessionLabel ? ` · ${sessionLabel}` : ''}
          </Text>
        </View>

        {badge && (
          <Text style={[styles.badge, { color: badge.color }]}>
            <Icon name={badge.icon} size={10} color={badge.color} />{'  '}{badge.label}
          </Text>
        )}

        <Pressable
          hitSlop={8}
          style={styles.expandBtn}
          onPress={(e) => {
            e.stopPropagation();
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpanded((v) => !v);
          }}
        >
          <Icon name="ellipsis-v" size={14} color={colors.tx3} />
        </Pressable>
      </Pressable>

      {expanded && !isBulkMode && (
        <View style={styles.actionsRow}>
          <ActionBtn label="Sửa" icon="edit" onPress={onEdit} color={colors.tx} bg={colors.bg3} />
          <ActionBtn
            label={isMastered ? 'Học lại' : 'Thuộc'}
            icon={isMastered ? 'undo' : 'check-circle'}
            onPress={onToggleMastered}
            color={accent.green}
            bg="rgba(63,185,80,0.1)"
          />
          <ActionBtn
            label={isFlagged ? 'Bỏ chú ý' : 'Chú ý'}
            icon="star"
            iconSolid={!isFlagged}
            onPress={onToggleFlagged}
            color={accent.yellow}
            bg="rgba(240,192,0,0.1)"
          />
          <ActionBtn label="Xoá" icon="trash" onPress={onDelete} color="#f78166" bg="rgba(247,129,102,0.1)" />
        </View>
      )}
    </View>
  );
}

function ActionBtn({
  label,
  onPress,
  color,
  bg,
  icon,
  iconSolid = true,
}: {
  label: string;
  onPress: () => void;
  color: string;
  bg: string;
  icon?: React.ComponentProps<typeof Icon>['name'];
  iconSolid?: boolean;
}) {
  return (
    <Pressable style={[styles.actionBtn, { backgroundColor: bg }]} onPress={onPress}>
      <Text style={{ color, fontSize: 12 }}>
        {icon ? (
          <>
            <Icon name={icon} size={11} color={color} solid={iconSolid} />{'  '}
          </>
        ) : null}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: mobile.wordItemRadius,
    marginBottom: mobile.wordItemGap,
    overflow: 'hidden',
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: mobile.wordItemMainMinHeight,
    paddingHorizontal: 10,
    gap: 8,
  },
  checkbox: {
    width: mobile.wordItemCheckboxSize,
    height: mobile.wordItemCheckboxSize,
    borderWidth: 1.5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  textCol: { flex: 1, minWidth: 0 },
  german: { fontSize: mobile.wordItemGermanSize, fontWeight: '700' },
  typeBadge: { fontSize: 11, fontWeight: '400' },
  meaning: { fontSize: mobile.wordItemMeaningSize, marginTop: 1 },
  badge: { fontSize: 11, fontWeight: '600' },
  expandBtn: {
    width: mobile.wordExpandBtnSize,
    height: mobile.wordExpandBtnSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 7,
  },
});
