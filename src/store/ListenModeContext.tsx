import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { VocabWord } from '@/types/models';
import { useListenMode } from '@/hooks/useListenMode';
import { classifyWordType } from '@/utils/grading';
import { useDataStore } from '@/store/DataStore';

/**
 * Bọc useListenMode() một lần DUY NHẤT ở gốc app (App.tsx → AppShell), thay
 * vì bên trong ListenModeModal. Lý do: nếu bộ máy phát (timer/token) sống
 * bên trong component modal, bất kỳ lần unmount/remount nào của modal đó
 * (chuyển màn hình trong drawer, Android thu hồi view, v.v.) đang diễn ra
 * giữa chừng chuỗi từ → nghĩa → ví dụ sẽ làm mất toàn bộ hàng đợi, giống
 * như app "tắt tiếng" đột ngột. Đặt ở Context gốc, không gắn với bất kỳ
 * màn hình nào, thì việc mở/đóng modal chỉ ẩn/hiện UI — giọng đọc và tiến
 * trình phát không bao giờ bị ảnh hưởng.
 *
 * Đồng thời quản lý 2 trạng thái hiển thị của "Nghe từ vựng":
 *  - modalVisible: modal toàn màn hình đang mở
 *  - minimized: đã thu nhỏ thành nút play lơ lửng (FloatingListenPlayer),
 *    trong khi giọng đọc/tiến trình vẫn tiếp tục chạy dưới nền
 *
 * "Sắp xếp theo loại từ" / "Nghe theo loại từ" (item 11, nay là bộ lọc
 * NHIỀU LỰA CHỌN kiểu Excel — xem WordTypeFilterDropdown.tsx): giữ danh
 * sách GỐC (rawWords, đúng như openWithWords nhận vào) tách biệt khỏi danh
 * sách THỰC SỰ đưa cho useListenMode — effectiveWords được lọc/sắp xếp lại
 * theo wordTypeFilter/sortByWordType. useListenMode() vốn đã có sẵn 1
 * effect reset toàn bộ tiến trình phát mỗi khi mảng `words` nó nhận đổi
 * (xem useListenMode.ts, effect theo dõi [words]) — nhờ vậy đổi bộ lọc/sắp
 * xếp ở đây tự động biên dịch lại chuỗi phát mà không cần đụng gì thêm vào
 * hook gốc.
 *
 * wordTypeFilter giờ là `string[] | null`: `null` = đang chọn TẤT CẢ loại
 * từ (không lọc gì), giống ô "(Select All)" đang tick trong bộ lọc Excel.
 * Khi người dùng bỏ tick bớt vài loại, đây là mảng các `key` còn được
 * chọn — nếu mảng phủ đủ hết wordTypeGroups thì được rút gọn về lại
 * `null` cho gọn state. Luôn giữ ÍT NHẤT 1 loại được chọn (không cho bỏ
 * tick hết), giống nguyên tắc "không cho tắt hết 3 công tắc" của
 * includeWord/Meaning/Example bên useListenMode.
 */
interface ListenModeContextValue extends ReturnType<typeof useListenMode> {
  words: VocabWord[];
  modalVisible: boolean;
  minimized: boolean;
  /** Mở modal "Nghe từ vựng" với danh sách từ mới (ví dụ phiên hiện tại).
   * `label` (tuỳ chọn): tên phiên hiển thị TĨNH trên thông báo/khoá màn
   * hình trong suốt lượt phát (vd. tên phiên, hoặc "Nhiều phiên" khi gộp). */
  openWithWords: (words: VocabWord[], label?: string) => void;
  /** Mở lại modal (không đổi danh sách từ) — dùng khi bấm vào nút nổi. */
  expand: () => void;
  /** Ẩn modal, thu nhỏ thành nút nổi — giọng đọc vẫn tiếp tục nếu đang phát. */
  minimize: () => void;
  /** Đóng hẳn — dừng phát, ẩn cả modal lẫn nút nổi. */
  close: () => void;

  /** Các loại từ có mặt trong danh sách gốc, kèm số lượng — dùng để hiện
   * chip lọc ("Nghe theo loại từ"). `key` là chuỗi đã chuẩn hoá (thường
   * dùng để so khớp), `label` là dạng hiển thị (giữ nguyên chữ người dùng
   * đã nhập, vd. "n", "Danh từ"...). */
  wordTypeGroups: { key: string; label: string; count: number }[];
  /** null = đang chọn TẤT CẢ loại từ (không lọc gì). Khác null = mảng các
   * `key` (trong wordTypeGroups) đang được chọn để nghe — kiểu bộ lọc
   * checkbox nhiều lựa chọn của Excel. */
  wordTypeFilter: string[] | null;
  /** Gán thẳng toàn bộ mảng filter (dùng khi áp dụng bản NHÁP từ popup "Cài
   * đặt nghe" lúc bấm "Lưu cài đặt" — khác toggleWordType vốn chỉ đổi 1
   * key mỗi lần). */
  setWordTypeFilterDirect: (v: string[] | null) => void;
  /** Bật/tắt riêng 1 loại từ (tick/bỏ tick 1 dòng trong bộ lọc). Không cho
   * bỏ tick nốt loại cuối cùng đang được chọn. */
  toggleWordType: (key: string) => void;
  /** Chọn tất cả loại từ ("(Select All)" được tick) — tương đương null. */
  selectAllWordTypes: () => void;
  /** true nếu `key` đang được chọn (đang nghe loại từ này). */
  isWordTypeSelected: (key: string) => boolean;
  /** Sắp xếp lại danh sách theo từng nhóm loại từ (gộp các từ cùng loại
   * lại gần nhau) thay vì giữ đúng thứ tự gốc trong phiên. */
  sortByWordType: boolean;
  setSortByWordType: (v: boolean) => void;

  /** Các nhóm TRẠNG THÁI từ có mặt trong danh sách gốc, kèm số lượng —
   * ("Chưa thuộc" / "Đã thuộc" / "Chú ý"). Khác "loại từ" (n/v/khác — mỗi
   * từ chỉ thuộc ĐÚNG 1 nhóm), 3 nhóm trạng thái này KHÔNG loại trừ nhau
   * (1 từ có thể vừa "Đã thuộc" vừa "Chú ý" cùng lúc) — lọc theo kiểu HOẶC
   * (OR): 1 từ được nghe nếu nó khớp BẤT KỲ nhóm trạng thái nào đang được
   * tick, không cần khớp hết. */
  statusGroups: { key: string; label: string; count: number }[];
  /** null = đang chọn TẤT CẢ trạng thái (không lọc gì). */
  statusFilter: string[] | null;
  setStatusFilterDirect: (v: string[] | null) => void;
  toggleStatus: (key: string) => void;
  selectAllStatuses: () => void;
}

const ListenModeContext = createContext<ListenModeContextValue | null>(null);

/** Nhãn hiển thị cố định cho 3 nhóm loại từ đã gộp — xem classifyWordType
 * trong utils/grading.ts (dùng chung với logic chấm bài). */
const WORD_TYPE_GROUP_LABELS: Record<'n' | 'v' | 'other', string> = {
  n: 'Danh từ',
  v: 'Động từ',
  other: 'Khác',
};

/** Nhãn hiển thị cố định cho 3 nhóm TRẠNG THÁI từ — khớp đúng chữ đang
 * dùng ở nơi khác trong app (WordItemCard, SelectWordsModal) để nhất quán. */
const STATUS_GROUP_LABELS: Record<'active' | 'mastered' | 'flagged', string> = {
  active: 'Chưa thuộc',
  mastered: 'Đã thuộc',
  flagged: 'Chú ý',
};

function normalizeWordTypeKey(wordType: string | undefined): string {
  return classifyWordType(wordType);
}

/** Logic "tick/bỏ tick 1 loại từ, không cho bỏ tick hết" — tách thành hàm
 * thuần (không phụ thuộc state) để dùng chung cho cả wordTypeFilter THẬT
 * (ListenModeContext, áp dụng ngay) lẫn bản NHÁP trong popup "Cài đặt nghe"
 * (chỉ áp dụng khi bấm "Lưu cài đặt" — xem ListenModeModal.tsx). */
export function toggleWordTypeFilterKey(
  current: string[] | null,
  key: string,
  allGroups: { key: string }[]
): string[] | null {
  const allKeys = allGroups.map((g) => g.key);
  const cur = current === null ? allKeys : current;
  const isSelected = cur.includes(key);
  const next = isSelected ? cur.filter((k) => k !== key) : [...cur, key];
  if (!next.length) return current; // không cho bỏ tick hết
  // Nếu next phủ đủ hết các loại đang có → rút gọn về null ("chọn tất cả").
  return next.length === allKeys.length ? null : next;
}

export function ListenModeProvider({ children }: { children: React.ReactNode }) {
  const [rawWords, setRawWords] = useState<VocabWord[]>([]);
  const [sessionLabel, setSessionLabel] = useState<string | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [wordTypeFilter, setWordTypeFilter] = useState<string[] | null>(null);
  const [sortByWordType, setSortByWordType] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[] | null>(null);
  // masteredIds/flaggedIds không nằm trên chính VocabWord (openWithWords
  // nhận vào danh sách "thô" từ vocab của phiên) — cần lấy riêng từ
  // DataStore (đã bọc ListenModeProvider ở App.tsx) để biết từ nào đang
  // "Đã thuộc"/"Chú ý" mà xây bộ lọc trạng thái.
  const { masteredIds, flaggedIds } = useDataStore();

  const wordTypeGroups = useMemo(() => {
    const counts: Record<'n' | 'v' | 'other', number> = { n: 0, v: 0, other: 0 };
    for (const w of rawWords) counts[classifyWordType(w.wordType)]++;
    // Chỉ hiện nhóm có ít nhất 1 từ, theo thứ tự cố định n → v → khác
    // (thay vì sắp theo số lượng) để danh sách ổn định, dễ đoán.
    return (['n', 'v', 'other'] as const)
      .filter((key) => counts[key] > 0)
      .map((key) => ({ key, label: WORD_TYPE_GROUP_LABELS[key], count: counts[key] }));
  }, [rawWords]);

  const statusGroups = useMemo(() => {
    const counts: Record<'active' | 'mastered' | 'flagged', number> = { active: 0, mastered: 0, flagged: 0 };
    for (const w of rawWords) {
      if (masteredIds.has(w.id)) counts.mastered++;
      else counts.active++;
      if (flaggedIds.has(w.id)) counts.flagged++;
    }
    return (['active', 'mastered', 'flagged'] as const)
      .filter((key) => counts[key] > 0)
      .map((key) => ({ key, label: STATUS_GROUP_LABELS[key], count: counts[key] }));
  }, [rawWords, masteredIds, flaggedIds]);

  const effectiveWords = useMemo(() => {
    let list = rawWords;
    if (wordTypeFilter !== null) {
      const selected = new Set(wordTypeFilter);
      list = list.filter((w) => selected.has(normalizeWordTypeKey(w.wordType)));
    }
    if (statusFilter !== null) {
      // Lọc kiểu HOẶC (OR): giữ từ nếu nó khớp BẤT KỲ trạng thái nào đang
      // được tick — vd. tick "Chưa thuộc" + "Chú ý" thì nghe cả từ chưa
      // thuộc LẪN từ đã thuộc nhưng có đánh dấu chú ý (xem giải thích ở
      // khai báo statusGroups trong interface phía trên).
      const selected = new Set(statusFilter);
      list = list.filter((w) => {
        const mastered = masteredIds.has(w.id);
        return (selected.has('active') && !mastered) || (selected.has('mastered') && mastered) || (selected.has('flagged') && flaggedIds.has(w.id));
      });
    }
    if (sortByWordType) {
      // Sắp xếp ỔN ĐỊNH (stable) theo thứ tự nhóm wordTypeGroups (nhiều từ
      // nhất trước) — các từ cùng loại được gộp gần nhau nhưng vẫn giữ
      // nguyên thứ tự tương đối ban đầu bên trong mỗi nhóm.
      const order = new Map(wordTypeGroups.map((g, i) => [g.key, i]));
      list = [...list].sort((a, b) => {
        const ka = order.get(normalizeWordTypeKey(a.wordType)) ?? 999;
        const kb = order.get(normalizeWordTypeKey(b.wordType)) ?? 999;
        return ka - kb;
      });
    }
    return list;
  }, [rawWords, wordTypeFilter, statusFilter, sortByWordType, wordTypeGroups, masteredIds, flaggedIds]);

  const listen = useListenMode(effectiveWords, sessionLabel);

  const selectAllWordTypes = useCallback(() => setWordTypeFilter(null), []);

  const isWordTypeSelected = useCallback(
    (key: string) => wordTypeFilter === null || wordTypeFilter.includes(key),
    [wordTypeFilter]
  );

  // Tick/bỏ tick 1 loại từ trong danh sách checkbox — giữ ÍT NHẤT 1 loại
  // đang được chọn (bỏ tick nốt cái cuối cùng thì bỏ qua thao tác, tránh
  // lọc sạch danh sách thành rỗng).
  const toggleWordType = useCallback(
    (key: string) => {
      setWordTypeFilter((prev) => toggleWordTypeFilterKey(prev, key, wordTypeGroups));
    },
    [wordTypeGroups]
  );

  const selectAllStatuses = useCallback(() => setStatusFilter(null), []);

  const toggleStatus = useCallback(
    (key: string) => {
      setStatusFilter((prev) => toggleWordTypeFilterKey(prev, key, statusGroups));
    },
    [statusGroups]
  );

  const openWithWords = useCallback((next: VocabWord[], label?: string) => {
    setRawWords(next);
    setSessionLabel(label);
    setModalVisible(true);
    setMinimized(false);
    // Mỗi phiên nghe mới bắt đầu lại từ "nghe tất cả loại từ" / không sắp
    // xếp lại — tránh trường hợp bộ lọc cũ (vd. chỉ "danh từ") vô tình lọc
    // sạch danh sách của phiên MỚI vừa mở khiến người dùng tưởng hết từ.
    setWordTypeFilter(null);
    setSortByWordType(false);
    setStatusFilter(null);
  }, []);

  const expand = useCallback(() => {
    setModalVisible(true);
    setMinimized(false);
  }, []);

  const minimize = useCallback(() => {
    setModalVisible(false);
    setMinimized(true);
  }, []);

  const close = useCallback(() => {
    listen.pause();
    setModalVisible(false);
    setMinimized(false);
  }, [listen]);

  return (
    <ListenModeContext.Provider
      value={{
        ...listen,
        words: rawWords,
        modalVisible,
        minimized,
        openWithWords,
        expand,
        minimize,
        close,
        wordTypeGroups,
        wordTypeFilter,
        setWordTypeFilterDirect: setWordTypeFilter,
        toggleWordType,
        selectAllWordTypes,
        isWordTypeSelected,
        sortByWordType,
        setSortByWordType,
        statusGroups,
        statusFilter,
        setStatusFilterDirect: setStatusFilter,
        toggleStatus,
        selectAllStatuses,
      }}
    >
      {children}
    </ListenModeContext.Provider>
  );
}

export function useListenModeCtx() {
  const ctx = useContext(ListenModeContext);
  if (!ctx) throw new Error('useListenModeCtx must be used within ListenModeProvider');
  return ctx;
}
