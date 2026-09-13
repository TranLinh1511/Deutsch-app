import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '@/theme/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useDataStore } from '@/store/DataStore';
import { useToast } from '@/store/ToastContext';
import BottomSheetModal from './BottomSheetModal';
import AuthButton from './auth/AuthButton';
import Icon from './Icon';
import {
  importWordsFromJsonText,
  importWordsFromExcelBase64,
  exportWordsToExcel,
  exportSessionsToExcel,
} from '@/services/importExport';

/**
 * Rebuild of the import/export tab (index.html: #importTabBtn word-group
 * modal tab / "📤 Xuất JSON" action) for word import/export. Session
 * import/export moved to the Home folder manager, so this modal now only
 * handles words.
 */
interface ImportExportModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ImportExportModal({ visible, onClose }: ImportExportModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { vocab, sessions, currentSessionId, refreshVocab, source, mergedSessionIds, mergedVocab } = useDataStore();
  const { showToast } = useToast();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function pickFile(extensions: string[], mimeTypes: string[]) {
    const res = await DocumentPicker.getDocumentAsync({ type: mimeTypes, copyToCacheDirectory: true });
    if (res.canceled) return null;
    return res.assets[0];
  }

  // ---- Words tab ----
  async function handleImportWords() {
    if (!currentSessionId) return;
    const file = await pickFile(
      ['json', 'xlsx', 'xls'],
      ['application/json', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    );
    if (!file) return;
    setBusy(true);
    setStatus('Đang nhập...');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let count = 0;
      if (ext === 'json') {
        const text = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
        count = await importWordsFromJsonText(user.uid, currentSessionId, text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        count = await importWordsFromExcelBase64(user.uid, currentSessionId, base64);
      } else {
        setStatus('Chỉ hỗ trợ JSON và Excel!');
        setBusy(false);
        return;
      }
      await refreshVocab();
      setStatus(`Đã nhập ${count} từ!`);
      showToast(`Nhập ${count} từ`, 'check-circle');
    } catch (e) {
      setStatus('Lỗi đọc file!');
    } finally {
      setBusy(false);
    }
  }

  const isMerged = source === 'merged';

  async function handleExportWords() {
    if (!currentSessionId) return;
    setBusy(true);
    try {
      if (isMerged) {
        // Chế độ "Gộp phiên" đang bật: xuất TẤT CẢ các phiên đang được gộp
        // vào cùng 1 file Excel, mỗi phiên là 1 sheet riêng — thay vì chỉ
        // xuất phiên hiện tại như trước.
        const sessIds = mergedSessionIds.length ? mergedSessionIds : [currentSessionId];
        const sessionsData = sessIds.map((sid) => ({
          name: sessions.find((s) => s.id === sid)?.name || sid,
          words: mergedVocab.filter((w) => w._sessId === sid),
        }));
        await exportSessionsToExcel(sessionsData, `Gop_phien_${sessionsData.length}.xlsx`);
        showToast(`Đã xuất ${sessionsData.length} phiên`, 'check-circle');
      } else {
        const sessName = sessions.find((s) => s.id === currentSessionId)?.name || 'session';
        await exportWordsToExcel(vocab, `${sessName}.xlsx`);
        showToast('Đã xuất Excel', 'check-circle');
      }
    } catch {
      showToast('Lỗi xuất Excel', 'times-circle');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.tx }]}>
          <Icon name="exchange-alt" size={14} color={colors.tx} />{'  '}Nhập / Xuất từ vựng
        </Text>

        {status && (
          <Text style={{ color: colors.tx2, fontSize: 12.8, marginBottom: 10 }}>{status}</Text>
        )}

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.tx3, fontSize: 12 }}>
            Nhập từ vào phiên đang mở từ file .json hoặc .xlsx (cột: Từ tiếng Đức, Loại từ, Nghĩa, Ví dụ).
          </Text>
          <AuthButton label="Nhập file (.json / .xlsx)" icon="file-import" onPress={handleImportWords} isLoading={busy} variant="blue" />
          <AuthButton
            label={isMerged ? `Xuất ${mergedSessionIds.length || 1} phiên đang gộp ra Excel` : 'Xuất phiên hiện tại ra Excel'}
            icon="file-export"
            onPress={handleExportWords}
            isLoading={busy}
            variant="green"
          />
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: '700', marginBottom: 14 },
});
