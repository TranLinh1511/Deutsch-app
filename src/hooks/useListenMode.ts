import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundTimer from 'react-native-background-timer';
import type { VocabWord } from '@/types/models';
import { getGermanExample, getVietnameseExample, getReducedTarget, classifyWordType } from '@/utils/grading';
import { speakQueueItem, stopSpeaking, startKeepAliveAudio, stopKeepAliveAudio } from '@/services/tts';
import { registerListenControls } from '@/services/listenPlaybackBridge';

/**
 * "Nghe từ vựng" (Listen Mode) — phát tuần tự toàn bộ danh sách từ của
 * phiên hiện tại, mỗi từ theo đúng thứ tự: nguyên từ (Đức) → nghĩa (Việt)
 * → câu ví dụ tiếng Đức → câu ví dụ tiếng Việt (nếu có). Chạy dưới nền
 * thật sự nhờ một foreground service của react-native-track-player (xem
 * startKeepAliveAudio()/stopKeepAliveAudio() trong services/tts.ts) — có
 * thông báo + nút điều khiển trên khoá màn hình như 1 trình phát nhạc
 * thật, và các nút đó (play/pause/tiếp/trước) được nối ngược lại đây qua
 * services/listenPlaybackBridge.ts. Chỉnh được tốc độ đọc + tốc độ chuyển
 * từ, cũng như bật/tắt riêng từng phần muốn nghe.
 *
 * Ba công tắc bật/tắt từng phần (lưu qua AsyncStorage), người dùng có thể
 * tắt bớt để chỉ nghe đúng phần muốn luyện:
 *  - includeWord: đọc nguyên từ tiếng Đức
 *  - includeMeaning: đọc nghĩa tiếng Việt
 *  - includeExample: đọc câu ví dụ (Đức rồi Việt, nếu có)
 * Luôn giữ ít nhất MỘT công tắc bật — tắt nốt cái cuối cùng sẽ bị bỏ qua,
 * để không rơi vào trạng thái "phát" mà không có gì để đọc.
 *
 * Hai thông số tốc độ (cũng lưu qua AsyncStorage):
 *  - rate: tốc độ đọc (truyền thẳng vào expo-speech `rate`)
 *  - nextWordDelayMs: khoảng nghỉ trước khi chuyển sang từ kế tiếp
 *
 * ── CÁC CÀI ĐẶT KIỂU "APP NGHE NHẠC" (mới) ──────────────────────────────
 * Toàn bộ danh sách từ được "biên dịch" thành 1 CHUỖI PHÁT (play order) —
 * một mảng phẳng chứa index thật của từng từ trong `words`, đã áp dụng đủ
 * ngẫu nhiên/chia nhóm/lặp lại. Playback chỉ biết đi tới lui trong chuỗi
 * này (xem buildPlayOrder), không cần biết gì về batch/repeat/shuffle:
 *  - shuffle: xáo trộn thứ tự các từ (giữ nguyên 1 thứ tự xáo đã chọn cho
 *    tới khi tắt/bật lại hoặc đổi danh sách từ, để không bị xáo lại liên tục)
 *  - batchSize: chia danh sách (đã xáo hoặc chưa) thành từng nhóm N từ;
 *    0 = không chia, cả danh sách là 1 nhóm
 *  - repeatBatchCount: phát trọn 1 nhóm xong thì lặp lại nguyên nhóm đó
 *    thêm (N-1) lần nữa trước khi sang nhóm kế
 *  - repeatWordCount: mỗi từ (word→nghĩa→ví dụ) được đọc lặp N lần liên
 *    tiếp trước khi sang từ kế trong nhóm
 *  - sleepMinutes/sleepRemainingSec: hẹn giờ tự dừng phát sau N phút,
 *    đếm ngược hiển thị bằng setInterval thường (chỉ để hiện UI), còn
 *    việc THỰC SỰ dừng lại dùng BackgroundTimer để không bị treo khi
 *    khoá màn hình (giống 2 timer điều phối chính bên dưới). Bộ đếm này
 *    CHỈ chạy khi đang thực sự phát (isPlaying === true): pause() làm nó
 *    "đứng hình" (pauseSleepTimer, giữ nguyên số giây còn lại) chứ không
 *    xoá, còn play() đếm TIẾP đúng chỗ đó (resumeSleepTimer) nếu có, hoặc
 *    bắt đầu đếm MỚI từ trọn vẹn số phút đã chọn nếu chưa từng đếm. Vào
 *    popup cài đặt đổi mốc phút rồi bấm "Lưu" trong lúc đang TẠM DỪNG sẽ
 *    KHÔNG tự khởi động đếm ngược ngay (xem setSleepTimerMinutes) — chỉ
 *    lưu lại lựa chọn, đếm ngược thật sự chờ tới lúc bấm phát.
 *
 * GHI CHÚ SỬA LỖI ANDROID: trước đây timer/token của bộ máy phát nằm ngay
 * trong component modal — nếu component đó bị unmount/remount (chuyển màn
 * hình, Android thu hồi bộ nhớ, drawer re-render...) khi đang ở giữa
 * chuỗi từ → nghĩa → ví dụ thì toàn bộ hàng đợi bị mất, tưởng như app
 * "tắt tiếng" giữa chừng. Cách sửa gồm 2 phần:
 *  1) Hook này giờ được khởi tạo một lần duy nhất ở gốc app (xem
 *     ListenModeContext) nên không bao giờ unmount theo màn hình/modal.
 *  2) Watchdog: nếu callback onDone của TextToSpeech (rất hay bị Android
 *     "nuốt mất" khi máy vào chế độ tiết kiệm pin hoặc khi bridge JS bị
 *     tạm dừng) không gọi về trong một khoảng ước lượng đủ rộng, ta tự
 *     ép chuyển sang mảnh kế tiếp thay vì treo im lặng mãi mãi.
 *  3) Hai timer điều phối cốt lõi (timerRef: chuyển sang mảnh/từ kế tiếp,
 *     watchdogRef: ép chuyển khi onDone bị mất) dùng
 *     react-native-background-timer thay vì setTimeout gốc. Lý do: khi
 *     khoá màn hình, CPU có thể đi ngủ (Doze / trình quản lý pin của
 *     hãng máy) khiến setTimeout gốc bị treo — mảnh đang đọc thì đọc
 *     xong (lệnh TTS đã "bắn" sang native), nhưng không bao giờ chuyển
 *     sang mảnh tiếp theo. startKeepAliveAudio()/stopKeepAliveAudio()
 *     trong services/tts.ts giữ một PARTIAL_WAKE_LOCK thật trong lúc
 *     đang phát để CPU không ngủ, và lịch của background-timer không bị
 *     JS-thread throttle như setTimeout gốc.
 */

export type ListenPieceKind = 'word' | 'meaning' | 'exampleDe' | 'exampleVi';

interface ListenPiece {
  text: string;
  lang: 'de-DE' | 'vi-VN';
  kind: ListenPieceKind;
}

const KEYS = {
  rate: 'beitl_listen_rate',
  gap: 'beitl_listen_gap_ms',
  includeWord: 'beitl_listen_include_word',
  includeMeaning: 'beitl_listen_include_meaning',
  includeExample: 'beitl_listen_include_example',
  repeatWord: 'beitl_listen_repeat_word',
  repeatBatch: 'beitl_listen_repeat_batch',
  batchSize: 'beitl_listen_batch_size',
  shuffle: 'beitl_listen_shuffle',
  sleepMinutes: 'beitl_listen_sleep_minutes',
};

// Cùng key AsyncStorage với usePracticeEngine's ENGINE_KEYS.strictVocabCheck
// — đây là MỘT cài đặt toàn cục duy nhất ("Kiểm tra chặt" trong Cài đặt),
// không phải bản sao riêng cho "Nghe từ vựng". Đọc trực tiếp key này (thay
// vì nhận qua prop) vì ListenModeProvider sống độc lập ở gốc app, tách rời
// khỏi usePracticeEngine.
const STRICT_VOCAB_CHECK_KEY = 'beitl_engine_strictVocabCheck';

export const RATE_MIN = 0.5;
export const RATE_MAX = 1.5;
export const RATE_STEP = 0.05;
export const GAP_MIN = 0;
export const GAP_MAX = 5000;
export const GAP_STEP = 250;
const INTRA_WORD_GAP_MS = 350; // khoảng nghỉ ngắn cố định giữa các mảnh trong cùng 1 từ

export const REPEAT_MIN = 1;
export const REPEAT_MAX = 5;
export const BATCH_SIZE_STEP = 5;
export const BATCH_SIZE_MIN = 0; // 0 = không chia nhóm, phát trọn cả danh sách
export const SLEEP_TIMER_PRESETS = [0, 5, 10, 15, 30, 60, 90]; // phút, 0 = tắt

// Watchdog: ước lượng thời gian đọc dựa trên độ dài văn bản (~70ms/ký tự ở
// rate=1, cộng biên độ an toàn), giới hạn trong khoảng [4s, 45s].
//
// SỬA LỖI (đọc đè lên nhau sau vài phút): trần cũ 20s quá thấp cho câu ví
// dụ dài đọc ở tốc độ chậm (rate=0.5 khiến mỗi ký tự mất gấp đôi thời
// gian) — với câu > ~150 ký tự, ước lượng thật sự vượt 20s nhưng bị cắt
// về đúng 20s, khiến watchdog LUÔN nổ sớm hơn lúc TTS thật sự đọc xong.
// Khi đó guardedAdvance() (xem playFrom) chuyển sang mảnh kế tiếp và bắt
// đầu đọc mảnh mới trong khi utterance cũ (đã "bắn" sang native rồi) vẫn
// còn đang phát — hai giọng chồng lên nhau. Nâng trần lên 45s để watchdog
// hiếm khi nổ sớm hơn thật; combo với guard chống gọi advance 2 lần +
// stopSpeaking() trước khi đọc mảnh kế (bên dưới) mới thực sự triệt tận gốc.
const WATCHDOG_MIN_MS = 6500;
const WATCHDOG_MAX_MS = 45000;
const WATCHDOG_MS_PER_CHAR = 70;
const WATCHDOG_BUFFER_MS = 4500;

function estimateWatchdogMs(text: string, rate: number): number {
  const perChar = WATCHDOG_MS_PER_CHAR / Math.max(0.5, rate);
  const est = text.length * perChar + WATCHDOG_BUFFER_MS;
  return Math.min(WATCHDOG_MAX_MS, Math.max(WATCHDOG_MIN_MS, est));
}

interface ListenToggles {
  includeWord: boolean;
  includeMeaning: boolean;
  includeExample: boolean;
}

function buildPieces(word: VocabWord, toggles: ListenToggles, strictVocabCheck: boolean): ListenPiece[] {
  const pieces: ListenPiece[] = [];
  const rawGerman = (word.originalGerman || word.mainGerman || '').trim();
  // Đối với ĐỘNG TỪ, khi "Kiểm tra chặt" đang TẮT: chỉ đọc nguyên thể
  // (phần trước dấu "(" — vd. "kommen (kommt, kam, ist gekommen)" → chỉ
  // đọc "kommen"), giống hệt cách checkWriteAnswer() rút gọn mục tiêu khi
  // chấm bài viết. Danh từ/loại từ khác vẫn đọc nguyên văn kể cả khi có
  // "(...)" (vd. dạng số nhiều), vì đó không phải thông tin chia động từ.
  const isVerb = classifyWordType(word.wordType) === 'v';
  const germanWord = isVerb ? getReducedTarget(rawGerman, strictVocabCheck) ?? rawGerman : rawGerman;
  if (toggles.includeWord && germanWord) {
    // Danh từ có dạng "das Mittel / die Mittel" (số ít / số nhiều, phân
    // cách bằng "/") — CHỈ đọc phần số ít (trước dấu "/"), bỏ qua số
    // nhiều, vì người học chỉ cần nghe đúng 1 dạng để nhận diện từ.
    const slashIdx = germanWord.indexOf('/');
    const singular = slashIdx > -1 ? germanWord.slice(0, slashIdx).trim() : germanWord;
    if (singular) pieces.push({ text: singular, lang: 'de-DE', kind: 'word' });
  }
  if (toggles.includeMeaning && word.meaning?.trim()) {
    pieces.push({ text: word.meaning.trim(), lang: 'vi-VN', kind: 'meaning' });
  }
  if (toggles.includeExample && word.example?.trim()) {
    const de = getGermanExample(word.example);
    const vi = getVietnameseExample(word.example);
    if (de) pieces.push({ text: de, lang: 'de-DE', kind: 'exampleDe' });
    if (vi) pieces.push({ text: vi, lang: 'vi-VN', kind: 'exampleVi' });
  }
  return pieces;
}

/** Xáo ngẫu nhiên kiểu Fisher–Yates, trả về mảng index [0..length-1] đã trộn. */
function shuffledIndices(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * "Biên dịch" danh sách từ thành 1 chuỗi phát phẳng (mảng index thật vào
 * `words`), áp dụng ngẫu nhiên → chia nhóm → lặp nhóm → lặp từng từ.
 * Ví dụ 6 từ [A,B,C,D,E,F], batchSize=3, repeatBatch=2, repeatWord=2:
 *   nhóm 1 [A,B,C] → lặp x2 → A A B B C C A A B B C C
 *   nhóm 2 [D,E,F] → lặp x2 → D D E E F F D D E E F F
 */
function buildPlayOrder(
  length: number,
  opts: { batchSize: number; repeatWord: number; repeatBatch: number; shuffle: boolean; shuffledBase: number[] }
): number[] {
  if (length <= 0) return [];
  const base =
    opts.shuffle && opts.shuffledBase.length === length ? opts.shuffledBase : Array.from({ length }, (_, i) => i);
  const bSize = opts.batchSize > 0 ? Math.min(opts.batchSize, length) : length;
  const repeatBatch = Math.max(1, opts.repeatBatch);
  const repeatWord = Math.max(1, opts.repeatWord);
  const order: number[] = [];
  for (let start = 0; start < base.length; start += bSize) {
    const batch = base.slice(start, start + bSize);
    for (let r = 0; r < repeatBatch; r++) {
      for (const idx of batch) {
        for (let w = 0; w < repeatWord; w++) order.push(idx);
      }
    }
  }
  return order;
}

export function useListenMode(words: VocabWord[], sessionTitle?: string) {
  const [rate, setRateState] = useState(0.85);
  const [nextWordDelayMs, setNextWordDelayState] = useState(1200);
  const [includeWord, setIncludeWordState] = useState(true);
  const [includeMeaning, setIncludeMeaningState] = useState(true);
  const [includeExample, setIncludeExampleState] = useState(true);
  const [repeatWordCount, setRepeatWordCountState] = useState(1);
  const [repeatBatchCount, setRepeatBatchCountState] = useState(1);
  const [batchSize, setBatchSizeState] = useState(0);
  const [shuffle, setShuffleState] = useState(false);
  const [sleepMinutes, setSleepMinutesState] = useState(90);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pos, setPos] = useState(0); // vị trí hiện tại trong chuỗi phát (orderRef)
  const [orderLength, setOrderLength] = useState(0);
  const [pieceKind, setPieceKind] = useState<ListenPieceKind | null>(null);

  const wordsRef = useRef(words);
  const sessionTitleRef = useRef(sessionTitle);
  useEffect(() => {
    sessionTitleRef.current = sessionTitle;
  }, [sessionTitle]);
  const rateRef = useRef(rate);
  const gapRef = useRef(nextWordDelayMs);
  const togglesRef = useRef<ListenToggles>({ includeWord, includeMeaning, includeExample });
  const strictVocabCheckRef = useRef(true);
  const repeatWordRef = useRef(repeatWordCount);
  const repeatBatchRef = useRef(repeatBatchCount);
  const batchSizeRef = useRef(batchSize);
  const shuffleRef = useRef(shuffle);
  const sleepMinutesRef = useRef(sleepMinutes);
  const posRef = useRef(0);
  const shuffledBaseRef = useRef<number[]>([]);
  const orderRef = useRef<number[]>([]);
  const tokenRef = useRef(0);
  // number thay vì ReturnType<typeof setTimeout>: đây là id trả về từ
  // react-native-background-timer, không phải Timeout gốc — xem chú thích
  // đầu file vì sao cần đổi (setTimeout gốc bị treo khi khoá màn hình).
  const timerRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const sleepTimerRef = useRef<number | null>(null);
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Theo dõi isPlaying qua ref để setSleepTimerMinutes (gọi từ popup cài đặt,
  // có thể lúc đó đang TẠM DỪNG) biết được có nên bắt đầu đếm ngược ngay hay
  // không — hẹn giờ đóng chỉ nên đếm khi thực sự đang phát, xem thêm chú
  // thích tại setSleepTimerMinutes bên dưới.
  const isPlayingRef = useRef(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  // Gương của sleepRemainingSec — để play() biết hẹn giờ đang "đứng hình"
  // giữa chừng (do vừa pause()) hay chưa từng bắt đầu, từ đó quyết định đếm
  // TIẾP từ số giây còn lại hay đếm MỚI từ trọn vẹn số phút đã chọn.
  const sleepRemainingSecRef = useRef<number | null>(null);
  useEffect(() => {
    sleepRemainingSecRef.current = sleepRemainingSec;
  }, [sleepRemainingSec]);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      BackgroundTimer.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const clearSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      BackgroundTimer.clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (sleepIntervalRef.current) {
      clearInterval(sleepIntervalRef.current);
      sleepIntervalRef.current = null;
    }
    setSleepRemainingSec(null);
  }, []);

  // Chỉ TẠM NGƯNG bộ đếm hẹn giờ (huỷ setTimeout/setInterval đang chạy) mà
  // KHÔNG xoá số giây còn lại đang hiển thị — dùng khi pause() để hẹn giờ
  // "đứng hình" đúng lúc tạm dừng, thay vì tiếp tục đếm ngầm rồi tự dừng
  // ngay cả khi người dùng không hề đang nghe. resumeSleepTimer() bên dưới
  // sẽ đếm tiếp từ đúng số giây còn lại này khi phát lại.
  const pauseSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      BackgroundTimer.clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (sleepIntervalRef.current) {
      clearInterval(sleepIntervalRef.current);
      sleepIntervalRef.current = null;
    }
  }, []);

  // Biên dịch lại chuỗi phát. Nếu keepWordIndex có giá trị, cố gắng giữ vị
  // trí đang phát đúng vào lần xuất hiện đầu tiên của từ đó trong chuỗi mới
  // (đổi tốc độ/lặp/chia nhóm giữa chừng không nên nhảy về đầu danh sách).
  const rebuildOrder = useCallback((keepWordIndex?: number) => {
    const length = wordsRef.current.length;
    if (shuffleRef.current && shuffledBaseRef.current.length !== length) {
      shuffledBaseRef.current = shuffledIndices(length);
    }
    const order = buildPlayOrder(length, {
      batchSize: batchSizeRef.current,
      repeatWord: repeatWordRef.current,
      repeatBatch: repeatBatchRef.current,
      shuffle: shuffleRef.current,
      shuffledBase: shuffledBaseRef.current,
    });
    orderRef.current = order;
    setOrderLength(order.length);
    if (!order.length) {
      setPos(0);
      return;
    }
    if (keepWordIndex != null) {
      const found = order.indexOf(keepWordIndex);
      setPos(found >= 0 ? found : 0);
    } else {
      setPos((p) => Math.min(p, order.length - 1));
    }
  }, []);

  useEffect(() => {
    wordsRef.current = words;
    // Danh sách đổi (ví dụ đổi phiên) → về lại từ đầu và dừng phát. Danh
    // sách xáo (nếu đang bật ngẫu nhiên) cũng phải làm mới theo độ dài mới.
    tokenRef.current++;
    stopSpeaking();
    stopKeepAliveAudio();
    if (timerRef.current) BackgroundTimer.clearTimeout(timerRef.current);
    clearWatchdog();
    clearSleepTimer();
    setIsPlaying(false);
    setPieceKind(null);
    shuffledBaseRef.current = shuffleRef.current ? shuffledIndices(words.length) : [];
    rebuildOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);
  useEffect(() => {
    gapRef.current = nextWordDelayMs;
  }, [nextWordDelayMs]);
  useEffect(() => {
    togglesRef.current = { includeWord, includeMeaning, includeExample };
  }, [includeWord, includeMeaning, includeExample]);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  // Đổi cài đặt lặp/chia nhóm → biên dịch lại chuỗi phát, cố gắng giữ
  // nguyên đúng từ đang phát dở thay vì nhảy về đầu.
  useEffect(() => {
    repeatWordRef.current = repeatWordCount;
    repeatBatchRef.current = repeatBatchCount;
    batchSizeRef.current = batchSize;
    const prevOrder = orderRef.current;
    const currentWordIdx = prevOrder.length ? prevOrder[posRef.current] : undefined;
    rebuildOrder(currentWordIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatWordCount, repeatBatchCount, batchSize]);

  // Đổi ngẫu nhiên → biên dịch lại chuỗi phát, giữ nguyên từ đang phát dở.
  useEffect(() => {
    shuffleRef.current = shuffle;
    const prevOrder = orderRef.current;
    const currentWordIdx = prevOrder.length ? prevOrder[posRef.current] : undefined;
    if (shuffle && shuffledBaseRef.current.length !== wordsRef.current.length) {
      shuffledBaseRef.current = shuffledIndices(wordsRef.current.length);
    }
    rebuildOrder(currentWordIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffle]);

  useEffect(() => {
    sleepMinutesRef.current = sleepMinutes;
  }, [sleepMinutes]);

  // Nạp cài đặt đã lưu khi hook được dùng lần đầu.
  useEffect(() => {
    (async () => {
      const [r, g, iw, im, ie, rw, rb, bs, sh, sm, svc] = await Promise.all([
        AsyncStorage.getItem(KEYS.rate),
        AsyncStorage.getItem(KEYS.gap),
        AsyncStorage.getItem(KEYS.includeWord),
        AsyncStorage.getItem(KEYS.includeMeaning),
        AsyncStorage.getItem(KEYS.includeExample),
        AsyncStorage.getItem(KEYS.repeatWord),
        AsyncStorage.getItem(KEYS.repeatBatch),
        AsyncStorage.getItem(KEYS.batchSize),
        AsyncStorage.getItem(KEYS.shuffle),
        AsyncStorage.getItem(KEYS.sleepMinutes),
        AsyncStorage.getItem(STRICT_VOCAB_CHECK_KEY),
      ]);
      if (svc != null) strictVocabCheckRef.current = svc !== 'false';
      if (r) {
        const n = parseFloat(r);
        if (!Number.isNaN(n)) setRateState(Math.min(RATE_MAX, Math.max(RATE_MIN, n)));
      }
      if (g) {
        const n = parseInt(g, 10);
        if (!Number.isNaN(n)) setNextWordDelayState(Math.min(GAP_MAX, Math.max(GAP_MIN, n)));
      }
      if (iw != null) setIncludeWordState(iw !== 'false');
      if (im != null) setIncludeMeaningState(im !== 'false');
      if (ie != null) setIncludeExampleState(ie !== 'false');
      if (rw) {
        const n = parseInt(rw, 10);
        if (!Number.isNaN(n)) setRepeatWordCountState(Math.min(REPEAT_MAX, Math.max(REPEAT_MIN, n)));
      }
      if (rb) {
        const n = parseInt(rb, 10);
        if (!Number.isNaN(n)) setRepeatBatchCountState(Math.min(REPEAT_MAX, Math.max(REPEAT_MIN, n)));
      }
      if (bs) {
        const n = parseInt(bs, 10);
        if (!Number.isNaN(n)) setBatchSizeState(Math.max(BATCH_SIZE_MIN, n));
      }
      if (sh != null) setShuffleState(sh === 'true');
      if (sm) {
        const n = parseInt(sm, 10);
        if (!Number.isNaN(n)) setSleepMinutesState(n);
      }
    })();
    return () => {
      tokenRef.current++;
      stopSpeaking();
      stopKeepAliveAudio();
      if (timerRef.current) BackgroundTimer.clearTimeout(timerRef.current);
      clearWatchdog();
      clearSleepTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playFrom = useCallback(
    (startPos: number, pIdx: number, token: number) => {
      if (token !== tokenRef.current) return;
      const order = orderRef.current;
      if (!order.length) {
        setIsPlaying(false);
        return;
      }
      if (startPos >= order.length) {
        // Hết chuỗi phát — TRƯỚC ĐÂY tự dừng hẳn tại đây. Giờ KHÔNG tự tắt
        // khi hết từ vựng nữa: lặp lại từ đầu và tiếp tục phát, cho tới
        // khi hẹn giờ đóng (mặc định 90 phút, xem play()) tự dừng, hoặc
        // người dùng chủ động bấm dừng. Nếu đang bật "ngẫu nhiên", xáo lại
        // thứ tự một lần nữa mỗi vòng lặp để không nghe đúng y hệt thứ tự
        // cũ lặp mãi.
        if (shuffleRef.current) {
          shuffledBaseRef.current = shuffledIndices(wordsRef.current.length);
          const newOrder = buildPlayOrder(wordsRef.current.length, {
            batchSize: batchSizeRef.current,
            repeatWord: repeatWordRef.current,
            repeatBatch: repeatBatchRef.current,
            shuffle: true,
            shuffledBase: shuffledBaseRef.current,
          });
          orderRef.current = newOrder;
          setOrderLength(newOrder.length);
        }
        setPos(0);
        playFrom(0, 0, token);
        return;
      }
      const wIdx = order[startPos];
      const word = wordsRef.current[wIdx];
      if (!word) {
        setIsPlaying(false);
        return;
      }
      const pieces = buildPieces(word, togglesRef.current, strictVocabCheckRef.current);
      if (pIdx >= pieces.length) {
        timerRef.current = BackgroundTimer.setTimeout(() => {
          if (token !== tokenRef.current) return;
          setPos(startPos + 1);
          playFrom(startPos + 1, 0, token);
        }, gapRef.current);
        return;
      }
      setPos(startPos);
      setPieceKind(pieces[pIdx].kind);
      timerRef.current = BackgroundTimer.setTimeout(
        () => {
          if (token !== tokenRef.current) return;
          const piece = pieces[pIdx];
          // SỬA LỖI ĐỌC ĐÈ LÊN NHAU: cả watchdog VÀ callback onDone thật của
          // TTS đều có thể gọi tới cùng một `advance` (vd. khi watchdog nổ
          // đúng lúc TTS cũng vừa đọc xong) — nếu không có cờ `advanced`,
          // playFrom(startPos, pIdx+1, token) bị gọi 2 LẦN cho cùng 1
          // token, tạo ra 2 chuỗi setTimeout/watchdog chạy song song và
          // đọc trồng lên nhau, càng lúc càng lệch pha sau vài phút. Cờ
          // cục bộ này đảm bảo dù cái nào gọi trước, chỉ 1 lần được thực
          // thi.
          //
          // SỬA LỖI "phát âm tiếng Đức chậm ~5 giây Ở MỌI LẦN chuyển từ/mảnh"
          // (xem giải thích đầy đủ ở speakText() trong services/tts.ts):
          // trước đây MỌI lần advance() đều gọi stopSpeaking() vô điều
          // kiện — kể cả khi advance được gọi từ onDONE THẬT (nghĩa là
          // utterance vừa đọc XONG TỰ NHIÊN, không còn gì để dừng). Gọi
          // stopSpeaking() dư thừa đó buộc AVSpeechSynthesizer khởi tạo
          // lại từ đầu cho mảnh TIẾP THEO, tốn vài giây riêng với tiếng
          // Đức — lặp lại ở MỌI lần chuyển mảnh trong suốt phiên "Nghe từ
          // vựng". Giờ CHỈ gọi stopSpeaking() khi advance() được kích hoạt
          // bởi WATCHDOG (viaWatchdog=true) — tức trường hợp utterance cũ
          // có thể vẫn đang đọc dở cần ngắt — bỏ qua hoàn toàn ở nhánh
          // onDone thật (viaWatchdog=false), vì lúc đó native đã tự dừng
          // phát rồi, không có gì để "stop" cả.
          let advanced = false;
          const advance = (viaWatchdog: boolean) => {
            if (advanced) return;
            advanced = true;
            clearWatchdog();
            if (viaWatchdog) stopSpeaking();
            if (token !== tokenRef.current) return;
            playFrom(startPos, pIdx + 1, token);
          };
          watchdogRef.current = BackgroundTimer.setTimeout(() => advance(true), estimateWatchdogMs(piece.text, rateRef.current));
          speakQueueItem(piece.text, piece.lang, rateRef.current, {
            onDone: () => advance(false),
          });
        },
        pIdx === 0 ? 0 : INTRA_WORD_GAP_MS
      );
    },
    [clearWatchdog]
  );

  const play = useCallback(() => {
    if (!orderRef.current.length) return;
    // Đọc lại "Kiểm tra chặt" mỗi lần bấm phát — người dùng có thể đã đổi
    // cài đặt này ở màn hình luyện tập trong lúc "Nghe từ vựng" đang tạm
    // dừng; không chờ Promise này xong vì chỉ ảnh hưởng phần rút gọn động
    // từ, không phải điều kiện để bắt đầu phát.
    AsyncStorage.getItem(STRICT_VOCAB_CHECK_KEY).then((svc) => {
      if (svc != null) strictVocabCheckRef.current = svc !== 'false';
    });
    const token = ++tokenRef.current;
    setIsPlaying(true);
    // Phát mồi câm lặp nền song song — giữ cho hệ điều hành coi app đang có
    // một phiên media thật đang chạy, để timer JS không bị Doze/treo khi
    // người dùng tắt màn hình (xem chú thích ở startKeepAliveAudio()).
    startKeepAliveAudio(sessionTitleRef.current);
    // Từ khi danh sách từ hết KHÔNG còn tự dừng nữa (lặp lại vô hạn — xem
    // playFrom), hẹn giờ đóng là cách DUY NHẤT để buổi nghe tự kết thúc.
    // Hẹn giờ CHỈ được đếm khi đang thực sự phát, nên mỗi lần bấm phát ở
    // đây phải tự quyết định: nếu đang có số giây còn lại bị "đứng hình" từ
    // lần tạm dừng trước (sleepRemainingSecRef != null) thì đếm TIẾP đúng
    // từ đó; còn nếu chưa từng bắt đầu / hẹn giờ cũ đã nổ (null) thì mới bắt
    // đầu đếm MỚI bằng trọn vẹn mốc phút đang chọn (mặc định 90 phút) —
    // không bắt người dùng phải tự bấm chọn lại mỗi lần.
    if (!sleepTimerRef.current && sleepMinutesRef.current > 0) {
      if (sleepRemainingSecRef.current != null) {
        resumeSleepTimerRef.current(sleepRemainingSecRef.current);
      } else {
        scheduleSleepStopRef.current(sleepMinutesRef.current);
      }
    }
    playFrom(posRef.current, 0, token);
  }, [playFrom]);

  const pause = useCallback(() => {
    tokenRef.current++;
    if (timerRef.current) BackgroundTimer.clearTimeout(timerRef.current);
    clearWatchdog();
    stopSpeaking();
    stopKeepAliveAudio();
    setIsPlaying(false);
    // Hẹn giờ đóng chỉ được phép đếm khi đang thực sự nghe — tạm dừng phát
    // thì cũng phải "đứng hình" bộ đếm hẹn giờ theo (không xoá số giây còn
    // lại, chỉ ngưng đếm), rồi đếm tiếp đúng chỗ khi bấm phát lại (xem
    // resumeSleepTimer trong play()).
    pauseSleepTimer();
  }, [clearWatchdog, pauseSleepTimer]);

  // Phần THỰC SỰ đếm ngược + dừng phát khi hết giờ, tách riêng khỏi
  // setSleepTimerMinutes để play() cũng gọi được (tự động bắt đầu đếm khi
  // bấm phát nếu chưa có hẹn giờ nào đang chạy — xem play() ở trên).
  // Dùng BackgroundTimer để không bị treo khi khoá màn hình; setInterval
  // thường chỉ chạy song song để cập nhật số đếm ngược hiển thị trên UI.
  const scheduleSleepStop = useCallback(
    (minutes: number) => {
      if (minutes <= 0) return;
      const totalSec = minutes * 60;
      setSleepRemainingSec(totalSec);
      sleepTimerRef.current = BackgroundTimer.setTimeout(() => {
        pause();
        clearSleepTimer();
      }, totalSec * 1000);
      sleepIntervalRef.current = setInterval(() => {
        setSleepRemainingSec((s) => (s == null ? null : Math.max(0, s - 1)));
      }, 1000);
    },
    [clearSleepTimer, pause]
  );

  // Đếm TIẾP hẹn giờ từ đúng số giây còn lại (sau khi pause() làm "đứng
  // hình" bộ đếm ở trên) khi phát lại — KHÔNG đặt lại về trọn vẹn số phút đã
  // chọn, tránh hẹn giờ tự nhiên "dài ra" mỗi lần tạm dừng rồi phát lại.
  const resumeSleepTimer = useCallback(
    (remainingSec: number) => {
      if (remainingSec <= 0) return;
      sleepTimerRef.current = BackgroundTimer.setTimeout(() => {
        pause();
        clearSleepTimer();
      }, remainingSec * 1000);
      sleepIntervalRef.current = setInterval(() => {
        setSleepRemainingSec((s) => (s == null ? null : Math.max(0, s - 1)));
      }, 1000);
    },
    [clearSleepTimer, pause]
  );

  // Ref để play() (khai báo phía TRÊN scheduleSleepStop/resumeSleepTimer
  // trong file) vẫn gọi được bản mới nhất mà không cần đưa vào mảng
  // dependency của play (tránh lỗi tham chiếu biến const trước khi khai báo).
  const scheduleSleepStopRef = useRef(scheduleSleepStop);
  useEffect(() => {
    scheduleSleepStopRef.current = scheduleSleepStop;
  }, [scheduleSleepStop]);
  const resumeSleepTimerRef = useRef(resumeSleepTimer);
  useEffect(() => {
    resumeSleepTimerRef.current = resumeSleepTimer;
  }, [resumeSleepTimer]);

  // Hẹn giờ đóng: chọn 1 mốc phút (0 = tắt) — do người dùng chủ động bấm
  // chọn trong popup cài đặt.
  // LƯU Ý: hẹn giờ CHỈ được phép đếm ngược khi người dùng đang thực sự nghe
  // (isPlaying === true). Popup cài đặt có thể mở/lưu ngay cả khi đang tạm
  // dừng — nếu cứ scheduleSleepStop() vô điều kiện như trước thì đồng hồ
  // đếm ngược chạy ngầm cả lúc KHÔNG nghe gì, khiến hẹn giờ nổ (tự dừng)
  // trong khi phiên nghe còn chưa bắt đầu / đang tạm dừng. Ở đây chỉ lưu lại
  // mốc phút đã chọn (persist AsyncStorage như cũ); việc đếm ngược thật sự sẽ
  // tự khởi động ngay khi bấm phát (xem điều kiện `!sleepTimerRef.current &&
  // sleepMinutesRef.current > 0` trong play() ở trên).
  const setSleepTimerMinutes = useCallback(
    (minutes: number) => {
      clearSleepTimer();
      setSleepMinutesState(minutes);
      AsyncStorage.setItem(KEYS.sleepMinutes, String(minutes));
      if (isPlayingRef.current) {
        scheduleSleepStop(minutes);
      }
    },
    [clearSleepTimer, scheduleSleepStop]
  );

  const jumpTo = useCallback(
    (idx: number) => {
      const order = orderRef.current;
      if (!order.length) return;
      const clamped = Math.max(0, Math.min(order.length - 1, idx));
      tokenRef.current++;
      if (timerRef.current) BackgroundTimer.clearTimeout(timerRef.current);
      clearWatchdog();
      stopSpeaking();
      setPos(clamped);
      setPieceKind(null);
      if (isPlaying) {
        const token = ++tokenRef.current;
        playFrom(clamped, 0, token);
      }
    },
    [isPlaying, playFrom, clearWatchdog]
  );

  const next = useCallback(() => jumpTo(pos + 1), [jumpTo, pos]);
  const prev = useCallback(() => jumpTo(pos - 1), [jumpTo, pos]);

  // Nối play/pause/next/prev hiện hành vào bridge để playbackService.ts
  // (chạy ngoài cây React, xử lý sự kiện từ thông báo/khoá màn hình) có
  // thể gọi thẳng vào bộ điều khiển thật đang sống ở đây. Cập nhật lại mỗi
  // khi các hàm này đổi (đổi theo wordIndex/isPlaying); gỡ đăng ký khi
  // unmount hẳn (chỉ xảy ra khi rời app).
  useEffect(() => {
    registerListenControls({ play, pause, next, prev });
    return () => registerListenControls(null);
  }, [play, pause, next, prev]);

  const setRate = useCallback((n: number) => {
    const clamped = Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, n)) * 100) / 100;
    setRateState(clamped);
    AsyncStorage.setItem(KEYS.rate, String(clamped));
  }, []);

  const setNextWordDelayMs = useCallback((n: number) => {
    const clamped = Math.min(GAP_MAX, Math.max(GAP_MIN, n));
    setNextWordDelayState(clamped);
    AsyncStorage.setItem(KEYS.gap, String(clamped));
  }, []);

  const setRepeatWordCount = useCallback((n: number) => {
    const clamped = Math.round(Math.min(REPEAT_MAX, Math.max(REPEAT_MIN, n)));
    setRepeatWordCountState(clamped);
    AsyncStorage.setItem(KEYS.repeatWord, String(clamped));
  }, []);

  const setRepeatBatchCount = useCallback((n: number) => {
    const clamped = Math.round(Math.min(REPEAT_MAX, Math.max(REPEAT_MIN, n)));
    setRepeatBatchCountState(clamped);
    AsyncStorage.setItem(KEYS.repeatBatch, String(clamped));
  }, []);

  const setBatchSize = useCallback((n: number) => {
    const clamped = Math.max(BATCH_SIZE_MIN, Math.round(n));
    setBatchSizeState(clamped);
    AsyncStorage.setItem(KEYS.batchSize, String(clamped));
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleState((prev) => {
      const next = !prev;
      AsyncStorage.setItem(KEYS.shuffle, String(next));
      return next;
    });
  }, []);

  // Không cho phép tắt hết cả 3 công tắc — nếu người dùng tắt nốt cái cuối
  // cùng đang bật thì bỏ qua thao tác đó, tránh trạng thái "phát" mà không
  // có gì để đọc (vòng lặp chạy qua hết danh sách trong im lặng).
  const toggleIncludeWord = useCallback(() => {
    setIncludeWordState((prev) => {
      const next = !prev;
      if (!next && !includeMeaning && !includeExample) return prev;
      AsyncStorage.setItem(KEYS.includeWord, String(next));
      return next;
    });
  }, [includeMeaning, includeExample]);

  const toggleIncludeMeaning = useCallback(() => {
    setIncludeMeaningState((prev) => {
      const next = !prev;
      if (!next && !includeWord && !includeExample) return prev;
      AsyncStorage.setItem(KEYS.includeMeaning, String(next));
      return next;
    });
  }, [includeWord, includeExample]);

  const toggleIncludeExample = useCallback(() => {
    setIncludeExampleState((prev) => {
      const next = !prev;
      if (!next && !includeWord && !includeMeaning) return prev;
      AsyncStorage.setItem(KEYS.includeExample, String(next));
      return next;
    });
  }, [includeWord, includeMeaning]);

  // Nếu app quay lại foreground giữa lúc "đang phát" nhưng vì lý do nào đó
  // (Android diệt tiến trình audio khi app ở nền quá lâu, không hỗ trợ nền)
  // không còn timer/watchdog nào đang chờ, phát lại đúng mảnh hiện tại thay
  // vì im lặng mãi mãi.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !isPlaying) return;
      if (timerRef.current || watchdogRef.current) return;
      const token = ++tokenRef.current;
      playFrom(pos, 0, token);
    });
    return () => sub.remove();
  }, [isPlaying, pos, playFrom]);

  const currentWordIndex = orderRef.current[pos] ?? 0;

  return {
    isPlaying,
    wordIndex: pos,
    pieceKind,
    currentWord: words[currentWordIndex] ?? null,
    total: orderLength,
    // Số thứ tự của từ gốc trong danh sách (để hiển thị "Từ X / Y" dễ hiểu
    // hơn là vị trí trong chuỗi phát đã bị xáo/lặp).
    origWordNumber: orderLength ? currentWordIndex + 1 : 0,
    origTotalWords: words.length,
    rate,
    setRate: (n: number) => setRate(n),
    incRate: () => setRate(rate + RATE_STEP),
    decRate: () => setRate(rate - RATE_STEP),
    nextWordDelayMs,
    setNextWordDelayMs: (n: number) => setNextWordDelayMs(n),
    incGap: () => setNextWordDelayMs(nextWordDelayMs + GAP_STEP),
    decGap: () => setNextWordDelayMs(nextWordDelayMs - GAP_STEP),
    includeWord,
    includeMeaning,
    includeExample,
    toggleIncludeWord,
    toggleIncludeMeaning,
    toggleIncludeExample,
    // Lặp lại từng từ (word→nghĩa→ví dụ đọc liền N lần rồi mới sang từ kế).
    repeatWordCount,
    setRepeatWordCount: (n: number) => setRepeatWordCount(n),
    incRepeatWordCount: () => setRepeatWordCount(repeatWordCount + 1),
    decRepeatWordCount: () => setRepeatWordCount(repeatWordCount - 1),
    // Lặp lại cả 1 nhóm từ (xem batchSize) trước khi sang nhóm kế.
    repeatBatchCount,
    setRepeatBatchCount: (n: number) => setRepeatBatchCount(n),
    incRepeatBatchCount: () => setRepeatBatchCount(repeatBatchCount + 1),
    decRepeatBatchCount: () => setRepeatBatchCount(repeatBatchCount - 1),
    // Chia danh sách thành từng nhóm N từ; 0 = không chia (cả danh sách).
    batchSize,
    setBatchSize: (n: number) => setBatchSize(n),
    incBatchSize: () => setBatchSize(batchSize + BATCH_SIZE_STEP),
    decBatchSize: () => setBatchSize(batchSize - BATCH_SIZE_STEP),
    // Phát ngẫu nhiên thứ tự các từ.
    shuffle,
    toggleShuffle,
    // Hẹn giờ tự dừng phát sau N phút (0 = tắt); sleepRemainingSec đếm
    // ngược để hiển thị, null khi không có hẹn giờ nào đang chạy.
    sleepMinutes,
    sleepRemainingSec,
    setSleepTimerMinutes,
    play,
    pause,
    togglePlay: () => (isPlaying ? pause() : play()),
    next,
    prev,
    hasNext: pos < orderLength - 1,
    hasPrev: pos > 0,
  };
}
