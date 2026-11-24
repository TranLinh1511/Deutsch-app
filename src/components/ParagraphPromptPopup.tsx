import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/theme/ThemeContext';
import { accent } from '@/theme/theme';
import { useDataStore } from '@/store/DataStore';
import { useToast } from '@/store/ToastContext';
import { CEFR_LEVELS, buildParagraphPrompt, type CefrLevel } from '@/constants/prompts';
import BottomSheetModal from './BottomSheetModal';
import Icon from './Icon';

interface ParagraphPromptPopupProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Popup mở khi bấm hàng "Prompt tạo đoạn văn..." trong Cài đặt > Tiện ích —
 * cùng kiểu với NotificationSettingsPopup / BreakSettingsPopup: chọn trình
 * độ, bấm nút để sao chép prompt kèm từ vựng của phiên đang mở (hoặc các
 * phiên đang gộp). Thông báo "Đã sao chép" hiện ngay trên nút vì toast gốc
 * nằm dưới Modal native nên không nhìn thấy được.
 */
export default function ParagraphPromptPopup({ visible, onClose }: ParagraphPromptPopupProps) {
  const { colors } = useTheme();
  const { vocab, mergedVocab, source } = useDataStore();
  const { showToast } = useToast();
  const [level, setLevel] = useState<CefrLevel>('B1');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const words = source === 'merged' ? mergedVocab : vocab;

  useEffect(() => {
    if (visible) setCopied(false);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [visible]);

  const handleCopy = async () => {
    if (!words.length) return;
    await Clipboard.setStringAsync(buildParagraphPrompt(level, words));
    setCopied(true);
    showToast(`Đã sao chép prompt ${level} (${words.length} từ)`, 'check-circle');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
      onClose();
    }, 1100);
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={[styles.title, { color: colors.tx }]}>
        <Icon name="edit" size={14} color={colors.tx} />{'  '}Prompt tạo đoạn văn
      </Text>

      <Text style={{ color: colors.tx3, fontSize: 12.5, marginBottom: 12 }}>
        {words.length
          ? `Dùng ${words.length} từ của ${source === 'merged' ? 'các phiên đang gộp' : 'phiên đang mở'}. Chọn trình độ đoạn văn:`
          : 'Bài hiện tại chưa có từ vựng nào để tạo prompt.'}
      </Text>

      <View style={styles.levels}>
        {CEFR_LEVELS.map((lv) => {
          const active = lv === level;
          return (
            <Pressable
              key={lv}
              onPress={() => setLevel(lv)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? 'rgba(88,166,255,0.18)' : colors.bg3,
                  borderColor: active ? '#58a6ff' : colors.border,
                },
              ]}
            >
              <Text style={{ color: active ? '#58a6ff' : colors.tx, fontSize: 14, fontWeight: '700' }}>{lv}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={handleCopy}
        disabled={!words.length}
        style={[
          styles.saveBtn,
          { backgroundColor: copied ? '#3fb950' : accent.blue, opacity: words.length ? 1 : 0.5 },
        ]}
      >
        <Icon name={copied ? 'check' : 'copy'} size={13} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 }}>
          {copied ? 'Đã sao chép!' : `Sao chép prompt ${level}`}
        </Text>
      </Pressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { minWidth: 52, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  saveBtn: {
    flexDirection: 'row',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
});
