import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { useDialogs } from '@/store/DialogsContext';
import BottomSheetModal from './BottomSheetModal';
import AuthButton from './auth/AuthButton';
import Icon from './Icon';
import { parseBulkWordText, type BulkWordDraft } from '@/utils/bulkWordParser';
import type { VocabWord } from '@/types/models';

/**
 * Checklist D.1: form thêm 1 từ thủ công — Từ tiếng Đức (có thể có biến
 * thể "die Schule / die Schulen"), Loại từ, Nghĩa tiếng Việt, Câu ví dụ.
 * Also used for editing (checklist D — "Sửa 1 từ đã có").
 *
 * Khi thêm mới (không phải sửa), hiển thị thêm tab "Hàng loạt" — dán nhiều
 * dòng "từ [tab] loại [tab] nghĩa [tab] ví dụ" (từ Excel/Sheets) để thêm
 * nhiều từ cùng lúc, thay vì phải mở form từng từ một.
 *
 * Khi đang sửa (initialWord có giá trị) và có onDelete, hiển thị thêm 1 nút
 * xoá (icon thùng rác) bên trái nút "Lưu thay đổi" — xoá thẳng từ đang sửa
 * ngay tại đây, không cần đóng form rồi tìm lại từ đó trong danh sách.
 */
interface WordFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (word: Pick<VocabWord, 'originalGerman' | 'mainGerman' | 'meaning' | 'wordType' | 'example'>) => void;
  onSubmitBulk?: (words: BulkWordDraft[]) => Promise<void> | void;
  onDelete?: () => void;
  initialWord?: VocabWord | null;
}

const BULK_PLACEHOLDER =
  'Nhập: từ [tab] loại [tab] nghĩa [tab] ví dụ\nVD:\ndie Schule / die Schulen\tn\ttrường học\tDie Schule ist groß.\nlaufen\tv\tchạy';

export default function WordFormModal({ visible, onClose, onSubmit, onSubmitBulk, onDelete, initialWord }: WordFormModalProps) {
  const { colors } = useTheme();
  const { customConfirm } = useDialogs();
  const [tab, setTab] = useState<'manual' | 'bulk'>('manual');
  const [german, setGerman] = useState('');
  const [wordType, setWordType] = useState('');
  const [meaning, setMeaning] = useState('');
  const [example, setExample] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setTab('manual');
      setGerman(initialWord?.originalGerman ?? '');
      setWordType(initialWord?.wordType ?? '');
      setMeaning(initialWord?.meaning ?? '');
      setExample(initialWord?.example ?? '');
      setBulkText('');
      setSubmitting(false);
    }
  }, [visible, initialWord]);

  function handleSubmit() {
    if (!german.trim() || !meaning.trim()) return;
    // mainGerman = phần trước dấu "/" đầu tiên (bỏ biến thể số nhiều), giữ
    // đúng quy ước originalGerman (đầy đủ) vs mainGerman (dùng để so khớp).
    const mainGerman = german.split('/')[0].trim();
    onSubmit({ originalGerman: german.trim(), mainGerman, meaning: meaning.trim(), wordType: wordType.trim(), example: example.trim() });
    onClose();
  }

  const { words: bulkWords, errors: bulkErrors } = parseBulkWordText(bulkText);

  async function handleDelete() {
    if (!onDelete) return;
    if (!(await customConfirm(`Xoá từ "${initialWord?.originalGerman}"?`))) return;
    onDelete();
    onClose();
  }

  async function handleSubmitBulk() {
    if (!onSubmitBulk || !bulkWords.length || submitting) return;
    setSubmitting(true);
    try {
      await onSubmitBulk(bulkWords);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const showTabs = !initialWord && !!onSubmitBulk;

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.tx }]}>
          <Icon name={initialWord ? 'edit' : 'plus'} size={14} color={colors.tx} />{'  '}
          {initialWord ? 'Sửa từ' : 'Thêm từ mới'}
        </Text>

        {showTabs && (
          <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
            <TabButton label="Thủ công" icon="file-alt" active={tab === 'manual'} onPress={() => setTab('manual')} />
            <TabButton label="Hàng loạt" icon="layer-group" active={tab === 'bulk'} onPress={() => setTab('bulk')} />
          </View>
        )}

        {tab === 'manual' || !showTabs ? (
          <>
            <Field
              label="Từ tiếng Đức"
              placeholder="die Schule / die Schulen"
              value={german}
              onChangeText={setGerman}
            />
            <Field label="Loại từ" placeholder="n, v, adj..." value={wordType} onChangeText={setWordType} autoCapitalize="none" />
            <Field label="Nghĩa tiếng Việt" placeholder="Trường học" value={meaning} onChangeText={setMeaning} />
            <Field label="Câu ví dụ" placeholder="Die Schule ist groß." value={example} onChangeText={setExample} multiline />

            <View style={styles.submitRow}>
              {!!initialWord && !!onDelete && (
                <Pressable style={[styles.deleteBtn, { borderColor: '#f78166' }]} onPress={handleDelete} hitSlop={4}>
                  <Icon name="trash" size={15} color="#f78166" />
                </Pressable>
              )}
              <View style={{ flex: 1 }}>
                <AuthButton label={initialWord ? 'Lưu thay đổi' : 'Thêm từ'} onPress={handleSubmit} variant="green" />
              </View>
            </View>
          </>
        ) : (
          <>
            <TextInput
              value={bulkText}
              onChangeText={setBulkText}
              placeholder={BULK_PLACEHOLDER}
              placeholderTextColor={colors.tx3}
              multiline
              autoCapitalize="none"
              style={[
                styles.bulkInput,
                { color: colors.tx, backgroundColor: colors.bg3, borderColor: colors.border, fontFamily: 'DM Mono' },
              ]}
            />

            {!!bulkText.trim() && (
              <View style={styles.bulkSummary}>
                {!!bulkWords.length && (
                  <Text style={{ color: '#3fb950', fontSize: 12.5, fontWeight: '600' }}>
                    <Icon name="check" size={11} color="#3fb950" />{'  '}Sẽ thêm {bulkWords.length} từ
                  </Text>
                )}
                {!!bulkErrors.length && (
                  <Text style={{ color: '#f78166', fontSize: 12, marginTop: 4 }}>
                    <Icon name="exclamation-triangle" size={10} color="#f78166" />{'  '}Bỏ qua {bulkErrors.length} dòng lỗi: {bulkErrors.slice(0, 3).map((e) => `dòng ${e.line} (${e.reason})`).join(', ')}
                    {bulkErrors.length > 3 ? '...' : ''}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.bulkBtnRow}>
              <Pressable style={[styles.btn, styles.btnGhost, { borderColor: colors.border }]} onPress={onClose}>
                <Text style={{ color: colors.tx2, fontSize: 14, fontWeight: '600' }}>Huỷ</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary, { opacity: bulkWords.length && !submitting ? 1 : 0.5 }]}
                onPress={handleSubmitBulk}
                disabled={!bulkWords.length || submitting}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                  {submitting ? 'Đang thêm...' : <><Icon name="upload" size={13} color="#fff" />{'  '}Nhập</>}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Icon>['name'];
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.tabBtn, active && { borderBottomColor: '#58a6ff' }]} onPress={onPress}>
      <Text style={{ color: active ? '#58a6ff' : colors.tx3, fontSize: 13.5, fontWeight: active ? '700' : '600' }}>
        {icon ? (
          <>
            <Icon name={icon} size={12} color={active ? '#58a6ff' : colors.tx3} />{'  '}
          </>
        ) : null}
        {label}
      </Text>
    </Pressable>
  );
}

function Field(props: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences';
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.tx3 }]}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.tx3}
        multiline={props.multiline}
        autoCapitalize={props.autoCapitalize}
        style={[
          styles.input,
          { color: colors.tx, backgroundColor: colors.bg3, borderColor: colors.border },
          props.multiline && { minHeight: 70, textAlignVertical: 'top' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  field: { marginBottom: 13 },
  label: { fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: 9, padding: 11, fontSize: 15 },
  tabRow: { flexDirection: 'row', gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  tabBtn: { paddingVertical: 9, paddingHorizontal: 4, marginRight: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  bulkInput: { borderWidth: 1.5, borderRadius: 9, padding: 11, fontSize: 12.5, minHeight: 140, textAlignVertical: 'top' },
  bulkSummary: { marginTop: 10 },
  bulkBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  submitRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  deleteBtn: { width: 48, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  btn: { borderRadius: 9, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { borderWidth: 1.5 },
  btnPrimary: { backgroundColor: '#58a6ff' },
});
