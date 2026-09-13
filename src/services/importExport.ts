import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as XLSX from 'xlsx';
import { dbGetSessionVocab, dbAddWord } from './firebase/words';
import { dbGetAllSessions, dbSaveSession } from './firebase/sessions';
import { dbGetMastered, dbGetFlagged, dbMarkMastered, dbMarkFlagged } from './firebase/masteredFlagged';
import type { VocabWord, Session } from '@/types/models';

const EXPORT_DIR_KEY = 'beitl_export_dir_uri';

/**
 * Thư mục SAF (Storage Access Framework) mà người dùng đã cấp quyền ghi
 * trực tiếp — chỉ Android mới có khái niệm Download công khai kiểu này.
 * URI được lưu lại (AsyncStorage) nên chỉ cần hỏi 1 lần; các lần xuất file
 * sau ghi thẳng vào đó, không hiện lại hộp thoại chọn thư mục hay hộp
 * thoại chia sẻ của hệ điều hành nữa.
 */
async function getExportDirUri(promptIfMissing: boolean): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  const saved = await AsyncStorage.getItem(EXPORT_DIR_KEY);
  if (saved) return saved;
  if (!promptIfMissing) return null;

  const wantsToPick = await new Promise<boolean>((resolve) => {
    Alert.alert(
      'Chọn thư mục lưu file',
      'Hãy chọn (hoặc tạo mới) thư mục "deutsch" bên trong Download — từ giờ mọi file xuất (JSON, Excel...) sẽ được lưu thẳng vào đó.',
      [
        { text: 'Để sau', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Chọn thư mục', onPress: () => resolve(true) },
      ]
    );
  });
  if (!wantsToPick) return null;

  let res: FileSystem.FileSystemRequestDirectoryPermissionsResult | null = null;
  try {
    const downloadHint = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
    res = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(downloadHint);
  } catch {
    try {
      res = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    } catch {
      res = null;
    }
  }
  if (!res || !res.granted) return null;
  await AsyncStorage.setItem(EXPORT_DIR_KEY, res.directoryUri);
  return res.directoryUri;
}

/** Cho phép chọn lại thư mục lưu file xuất — dùng cho nút trong Cài đặt. */
export async function resetExportDirectory() {
  await AsyncStorage.removeItem(EXPORT_DIR_KEY);
}

/**
 * index.html: downloadBlob/mobileDownload — the original juggles blob: URIs,
 * data: URIs, and the Web Share API depending on browser/WebView. None of
 * that applies in RN.
 *
 * Android: ghi thẳng vào thư mục SAF đã chọn (mặc định hướng dẫn
 * Download/deutsch ở lần xuất đầu tiên, xem getExportDirUri) — người dùng
 * mở Download/deutsch trên máy là thấy file ngay, không cần qua hộp thoại
 * chia sẻ mỗi lần.
 * iOS (không có khái niệm thư mục Download công khai) và trường hợp
 * Android không lấy được quyền thư mục: quay lại cách cũ — ghi vào cache
 * app rồi đưa cho OS share sheet qua expo-sharing.
 */
async function saveAndShareFile(content: string, filename: string, mimeType: string, base64 = false) {
  const encoding = base64 ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8;

  if (Platform.OS === 'android') {
    try {
      const dirUri = await getExportDirUri(true);
      if (dirUri) {
        // createFileAsync muốn tên file KHÔNG kèm đuôi mở rộng — Android tự
        // thêm đuôi phù hợp dựa trên mimeType.
        const baseName = filename.replace(/\.[^./\\]+$/, '');
        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(dirUri, baseName, mimeType);
        await FileSystem.writeAsStringAsync(fileUri, content, { encoding });
        return fileUri;
      }
    } catch {
      // Thư mục đã lưu không còn dùng được nữa (bị xoá, thu hồi quyền...)
      // — xoá để lần xuất sau hỏi lại, rơi xuống cách cũ cho lần xuất này.
      await AsyncStorage.removeItem(EXPORT_DIR_KEY).catch(() => {});
    }
  }

  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, content, { encoding });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
  }
  return uri;
}

function uid() {
  return 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

interface RawImportRow {
  german?: string;
  originalGerman?: string;
  de?: string;
  wordType?: string;
  word_type?: string;
  type?: string;
  meaning?: string;
  vi?: string;
  vietnamese?: string;
  example?: string;
  beispiel?: string;
}

/** index.html: doImportWords(words) inside importFromFile() */
async function doImportWords(uid_: string, sid: string, words: RawImportRow[]): Promise<number> {
  let count = 0;
  const vocab = await dbGetSessionVocab(uid_, sid);
  for (const item of words) {
    const g = String(item.german || item.originalGerman || item.de || '').trim();
    const wt = String(item.wordType || item.word_type || item.type || '').trim();
    const m = String(item.meaning || item.vi || item.vietnamese || '').trim();
    const ex = String(item.example || item.beispiel || '').trim();
    if (!g || !m) continue;
    let main = g.split('/')[0].trim();
    if (!/^(der|die|das)\s+\S+/.test(main)) main = g;
    const word: VocabWord = { id: uid(), originalGerman: g, mainGerman: main, meaning: m, wordType: wt, example: ex };
    await dbAddWord(uid_, sid, word, vocab.length + count);
    count++;
  }
  return count;
}

/** index.html: importFromFile(file) — ext === "json" branch */
export async function importWordsFromJsonText(uid_: string, sid: string, jsonText: string): Promise<number> {
  const data = JSON.parse(jsonText);
  if (!Array.isArray(data)) throw new Error('File JSON không hợp lệ!');
  return doImportWords(uid_, sid, data);
}

/** index.html: importFromFile(file) — ext === "xlsx"/"xls" branch */
export async function importWordsFromExcelBase64(uid_: string, sid: string, base64Content: string): Promise<number> {
  const wb = XLSX.read(base64Content, { type: 'base64' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const startRow = rows[0] && ['Từ tiếng Đức', 'German', 'german'].includes(rows[0][0]) ? 1 : 0;
  const words: RawImportRow[] = rows
    .slice(startRow)
    .map((row) => ({
      german: String(row[0] || '').trim(),
      wordType: String(row[1] || '').trim(),
      meaning: String(row[2] || '').trim(),
      example: String(row[3] || '').trim(),
    }))
    .filter((w) => w.german && w.meaning);
  return doImportWords(uid_, sid, words);
}

/** Dựng 1 worksheet từ vựng dùng chung cho cả xuất 1 phiên và xuất nhiều phiên. */
function buildVocabSheet(words: VocabWord[]) {
  const data = [
    ['Từ tiếng Đức', 'Loại từ', 'Nghĩa', 'Ví dụ'],
    ...words.map((w) => [w.originalGerman || '', w.wordType || '', w.meaning || '', w.example || '']),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 35 }, { wch: 10 }, { wch: 30 }, { wch: 45 }];
  return ws;
}

// Excel giới hạn tên sheet tối đa 31 ký tự và cấm các ký tự \ / ? * [ ] : —
// đồng thời không cho phép 2 sheet trùng tên. Tên phiên do người dùng đặt có
// thể vi phạm cả hai điều này (dài hơn 31 ký tự, chứa "/", hoặc hai phiên
// trùng tên ở hai thư mục khác nhau khi gộp xuất theo thư mục), nên cần
// làm sạch + đảm bảo duy nhất trước khi đưa vào workbook.
const INVALID_SHEET_CHARS = /[\\/?*[\]:]/g;
function uniqueSheetName(rawName: string, used: Set<string>): string {
  const base = (rawName || 'Sheet').replace(INVALID_SHEET_CHARS, ' ').trim().slice(0, 31) || 'Sheet';
  let name = base;
  let i = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${i})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  used.add(name.toLowerCase());
  return name;
}

/** index.html: exportToExcel(words, filename) */
export async function exportWordsToExcel(words: VocabWord[], filename: string): Promise<string> {
  const ws = buildVocabSheet(words);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Từ vựng');
  // bookSST: true -> ép ghi bảng Shared Strings (sharedStrings.xml) thay vì
  // inline strings mặc định. Inline strings hợp lệ nhưng nhiều app xem Excel
  // trên Android (trình xem file mặc định, WPS bản cũ...) không đọc được,
  // khiến các ô chứa chữ hiển thị trống/ẩn nội dung dù file không hề lỗi.
  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64', bookSST: true });
  return saveAndShareFile(
    base64,
    filename,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    true
  );
}

/**
 * Xuất nhiều phiên ra CÙNG 1 file Excel, mỗi phiên là 1 sheet riêng
 * (tên sheet = tên phiên, làm sạch + khử trùng lặp). Dùng cho nút "Xuất
 * Excel cả thư mục" — gộp mọi phiên trong 1 thư mục (và thư mục con) lại.
 */
export async function exportSessionsToExcel(
  sessionsData: { name: string; words: VocabWord[] }[],
  filename: string
): Promise<string> {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  for (const { name, words } of sessionsData) {
    const ws = buildVocabSheet(words);
    XLSX.utils.book_append_sheet(wb, ws, uniqueSheetName(name, usedNames));
  }
  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64', bookSST: true });
  return saveAndShareFile(
    base64,
    filename,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    true
  );
}

interface ExportedSessionData {
  _format: 'germanApp_sessions_v1';
  _exported: string;
  sessions: {
    id: string;
    name: string;
    createdAt: number;
    vocabulary: (VocabWord & { mastered: boolean; flagged: boolean })[];
  }[];
}

/** index.html: exportSessionsToJson(sessionIds) */
export async function exportSessionsToJson(uid_: string, sessionIds: string[]): Promise<ExportedSessionData> {
  const data: ExportedSessionData = { _format: 'germanApp_sessions_v1', _exported: new Date().toISOString(), sessions: [] };
  const allSessions = await dbGetAllSessions(uid_);
  for (const sid of sessionIds) {
    const sessInfo = allSessions.find((s) => s.id === sid);
    if (!sessInfo) continue;
    const [vocab, mIds, fIds] = await Promise.all([
      dbGetSessionVocab(uid_, sid),
      dbGetMastered(uid_, sid),
      dbGetFlagged(uid_, sid),
    ]);
    data.sessions.push({
      id: sessInfo.id,
      name: sessInfo.name,
      createdAt: sessInfo.createdAt,
      vocabulary: vocab.map((w) => ({ ...w, mastered: mIds.has(w.id), flagged: fIds.has(w.id) })),
    });
  }
  return data;
}

/** Wraps exportSessionsToJson + saveAndShareFile — the full "Xuất JSON" button action */
export async function exportSessionsToJsonFile(uid_: string, sessionIds: string[], filename: string) {
  const data = await exportSessionsToJson(uid_, sessionIds);
  return saveAndShareFile(JSON.stringify(data, null, 2), filename, 'application/json', false);
}

/** index.html: importSessionsFromData(data) */
export async function importSessionsFromData(
  uid_: string,
  data: ExportedSessionData
): Promise<{ ok: boolean; msg?: string; totalSessions?: number; totalWords?: number }> {
  if (!data || !Array.isArray(data.sessions)) return { ok: false, msg: 'File không hợp lệ!' };

  let totalSessions = 0;
  let totalWords = 0;
  const allSessions = await dbGetAllSessions(uid_);

  for (const sess of data.sessions) {
    if (!sess.name || !Array.isArray(sess.vocabulary)) continue;

    const existing = allSessions.find((s) => s.name === sess.name);
    let sid: string;
    if (existing) {
      sid = existing.id;
    } else {
      sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const newSess: Session = { id: sid, name: sess.name, createdAt: sess.createdAt || Date.now() };
      await dbSaveSession(uid_, newSess);
      totalSessions++;
    }

    const currentVocab = await dbGetSessionVocab(uid_, sid);
    const existingGerman = new Set(currentVocab.map((v) => v.originalGerman.toLowerCase()));
    let wordOrder = currentVocab.length;

    for (const w of sess.vocabulary) {
      if (!w.originalGerman || !w.meaning) continue;
      if (existingGerman.has(w.originalGerman.toLowerCase())) continue;
      const newId = uid();
      await dbAddWord(
        uid_,
        sid,
        {
          id: newId,
          originalGerman: w.originalGerman,
          mainGerman: w.mainGerman || w.originalGerman.split('/')[0].trim(),
          meaning: w.meaning,
          wordType: w.wordType || '',
          example: w.example || '',
        },
        wordOrder++
      );
      if (w.mastered) await dbMarkMastered(uid_, sid, newId);
      if (w.flagged) await dbMarkFlagged(uid_, sid, newId);
      totalWords++;
    }
  }

  return { ok: true, totalSessions, totalWords };
}
