import * as Speech from 'expo-speech';
import TrackPlayer, {
  Capability,
  AppKilledPlaybackBehavior,
  RepeatMode,
  IOSCategory,
  IOSCategoryOptions,
} from 'react-native-track-player';
import BackgroundTimer from 'react-native-background-timer';
import { getGermanExample, getReducedTarget } from '@/utils/grading';
import type { Question, ExerciseType } from '@/utils/questionBuilder';

/**
 * TTS — ported from index.html's speakText()/speakForMode()/_speakLang().
 *
 * DELIBERATE DEVIATION: the original's PRIMARY path scrapes an undocumented
 * endpoint (translate.googleapis.com/translate_tts) via fetch+AudioContext
 * (desktop) or an <audio> element (mobile WebView), only falling back to
 * the real Web Speech API if that request fails. That endpoint is
 * unofficial, unthrottled-but-rate-limitable, and not something to depend
 * on in a shipped app. `expo-speech` wraps each platform's real native TTS
 * engine (AVSpeechSynthesizer on iOS, TextToSpeech on Android) — it IS the
 * proper equivalent of the original's *fallback* (Web Speech API), and is
 * more reliable than the primary path was. Behavior contract (what speaks,
 * when, controlled by which setting) is kept identical; only the audio
 * backend differs.
 */
let soundEnabledRef = true;

/**
 * CỜ CHẨN ĐOÁN TẠM THỜI (2026-08-29): đặt true để tắt hẳn track-player
 * trong "Nghe từ vựng", chỉ giữ BackgroundTimer wake-lock — dùng để kiểm
 * tra xem TrackPlayer có phải nguyên nhân khiến giọng đọc tiếng Đức bị
 * im lặng hoàn toàn trong "Nghe từ vựng" hay không. Nếu bật cờ này mà
 * tiếng Đức phát được bình thường trong "Nghe từ vựng" → xác nhận đúng
 * nguyên nhân, sẽ tìm cách giữ cả 2 (track-player + giọng đọc) sau. Nếu
 * bật cờ này mà tiếng Đức VẪN im lặng → không phải do track-player, cần
 * tìm hướng khác. Nhớ đặt lại false (hoặc xoá cờ này) sau khi xác định
 * xong nguyên nhân — true nghĩa là mất tính năng giữ app thức khi khoá
 * màn hình lúc đang "Nghe từ vựng".
 */
const DEBUG_DISABLE_TRACKPLAYER_KEEPALIVE = false;

/**
 * "Trình phát nền" cho Nghe từ vựng, dựng trên react-native-track-player.
 *
 * TẠI SAO ĐỔI SANG TRACK-PLAYER (thay cho mồi câm qua expo-av trước đó):
 * expo-speech gọi thẳng công cụ TTS gốc của hệ điều hành — nó không đứng
 * sau một audio-session mà Android công nhận là "đang phát media thật".
 * expo-av's staysActiveInBackground chỉ cấu hình audio-session, KHÔNG dựng
 * foreground service + thông báo — nên khi khoá màn hình, Android vẫn có
 * thể Doze/điều tiết mạnh tiến trình JS, khiến timer điều phối
 * từ→nghĩa→ví dụ trong useListenMode bị treo giữa chừng.
 *
 * react-native-track-player thì khác: nó chạy một foreground service THẬT
 * kèm thông báo media-style (như một trình phát nhạc) — loại service này
 * được Android miễn trừ khỏi Doze khi đang active. Ở đây nó chỉ phát một
 * track câm (silence.mp3) lặp vô hạn để "giữ chỗ" service đó; giọng đọc
 * thật vẫn hoàn toàn do expo-speech đảm nhiệm như cũ. Đổi lại có thêm:
 *  - Thông báo thật trên thanh trạng thái + màn hình khoá, có nút
 *    play/pause/tiếp/trước — bấm vào đó điều khiển thẳng "Nghe từ vựng"
 *    (nối qua listenPlaybackBridge.ts, vì playbackService.ts chạy ngoài
 *    cây React — xem file đó).
 *
 * NHƯNG foreground service KHÔNG giữ CPU thức — nó chỉ giữ cho tiến trình
 * không bị hệ thống giết. Khi khoá màn hình, CPU vẫn có thể đi ngủ (Doze /
 * trình quản lý pin của hãng máy như MIUI, EMUI...), lúc đó toàn bộ
 * setTimeout/watchdog điều phối từ→nghĩa→ví dụ trong useListenMode bị
 * treo cứng: mảnh đang đọc thì vẫn đọc xong (vì lệnh gọi TTS đã "bắn" sang
 * native rồi), nhưng callback onDone quay lại JS để đọc tiếp thì không
 * chạy nữa — nghe như "đọc được 1 từ rồi im".
 *
 * Vì vậy cần thêm react-native-background-timer: start()/stop() của nó
 * giữ một PARTIAL_WAKE_LOCK thật (PowerManager) trong lúc "Nghe từ vựng"
 * đang phát, để CPU không ngủ; và setTimeout()/clearTimeout() của nó được
 * dùng thay cho setTimeout gốc trong useListenMode.ts, vì lịch native của
 * nó không bị JS-thread throttle như setTimeout gốc.
 */
let playerSetupPromise: Promise<void> | null = null;
let keepAliveActive = false;
let wakeLockActive = false;

async function setupTrackPlayerOnce(): Promise<void> {
  if (playerSetupPromise) return playerSetupPromise;
  playerSetupPromise = (async () => {
    await TrackPlayer.setupPlayer({
      // QUAN TRỌNG: mặc định TrackPlayer chiếm audio session kiểu "độc
      // quyền" trên iOS, khiến expo-speech (AVSpeechSynthesizer) không
      // phát ra được tiếng khi track câm đang chạy — đây chính là lý do
      // "Nghe từ vựng" trước đây im lặng hoàn toàn với tiếng Đức. Thêm
      // iosCategory 'playback' + option 'mixWithOthers' để cho phép âm
      // thanh khác (giọng đọc) phát chồng lên track câm này thay vì bị
      // chặn.
      iosCategory: IOSCategory.Playback,
      iosCategoryOptions: [IOSCategoryOptions.MixWithOthers],
    });
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.Stop,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
      notificationCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious],
    });
  })();
  return playerSetupPromise;
}

/**
 * Bắt đầu (hoặc tiếp tục) trình phát nền — gọi khi bấm play ở "Nghe từ
 * vựng". An toàn khi gọi nhiều lần liên tiếp.
 *
 * `sessionTitle` (tuỳ chọn): tên phiên đang phát (vd. tên phiên/thư mục
 * hiện tại, hoặc "Nhiều phiên" khi đang gộp) — hiển thị TĨNH trên thông
 * báo/khoá màn hình trong suốt lượt phát, KHÔNG đổi theo từng từ đang đọc
 * (khác bản trước: đổi title theo từng mảnh từ→nghĩa→ví dụ, trông giật
 * cục và không rõ nghĩa). `duration: 0` trên track câm để thanh tiến
 * trình hiện cố định 00:00–00:00 thay vì độ dài thật của silence.mp3
 * (~2s, bị lặp liên tục trông như đang phát 1 bài nhạc 2 giây).
 */
export async function startKeepAliveAudio(sessionTitle?: string) {
  const title = sessionTitle?.trim() || 'Nghe từ vựng';
  if (keepAliveActive) {
    // Đã đang phát — chỉ cập nhật lại tên phiên nếu người dùng mở "Nghe từ
    // vựng" với danh sách khác trong khi vẫn giữ trình phát nền sống.
    await TrackPlayer.updateNowPlayingMetadata({ title, artist: 'bei TL', duration: 0 }).catch(() => {});
    return;
  }
  // Giữ CPU thức trước — độc lập với track-player, để dù track-player có
  // lỗi/không dựng được, chuỗi setTimeout điều phối trong useListenMode
  // vẫn có cơ hội chạy tiếp khi khoá màn hình.
  try {
    BackgroundTimer.start();
    wakeLockActive = true;
  } catch {
    wakeLockActive = false;
  }
  if (DEBUG_DISABLE_TRACKPLAYER_KEEPALIVE) {
    keepAliveActive = true;
    return;
  }
  try {
    await setupTrackPlayerOnce();
    const queue = await TrackPlayer.getQueue();
    if (!queue.length) {
      await TrackPlayer.add({
        url: require('../../assets/audio/silence.mp3'),
        title,
        artist: 'bei TL',
        duration: 0,
      });
    } else {
      await TrackPlayer.updateNowPlayingMetadata({ title, artist: 'bei TL', duration: 0 }).catch(() => {});
    }
    await TrackPlayer.setRepeatMode(RepeatMode.Track);
    await TrackPlayer.play();
    keepAliveActive = true;
  } catch {
    // Không nghiêm trọng — nếu trình phát nền không dựng được (ví dụ bản
    // build cũ chưa có module native này), TTS vẫn phát bình thường khi
    // app đang mở, chỉ kém tin cậy hơn khi khoá màn hình.
    keepAliveActive = false;
  }
}

/** Dừng hẳn trình phát nền + gỡ thông báo — gọi khi pause()/đóng "Nghe từ vựng" hoặc phát hết danh sách. */
export async function stopKeepAliveAudio() {
  if (wakeLockActive) {
    wakeLockActive = false;
    try {
      BackgroundTimer.stop();
    } catch {
      // ignore
    }
  }
  if (!keepAliveActive) return;
  keepAliveActive = false;
  if (DEBUG_DISABLE_TRACKPLAYER_KEEPALIVE) return;
  try {
    await TrackPlayer.reset();
  } catch {
    // ignore
  }
}

/** Call once from SettingsContext when the user toggles the sound setting. */
export function setTtsSoundEnabled(enabled: boolean) {
  soundEnabledRef = enabled;
}

/**
 * SỬA LỖI "phát âm tiếng Đức bị chậm ~5 giây" (chỉ tiếng Đức, tiếng Việt vẫn
 * nhanh bình thường trên CÙNG máy): nguyên nhân phổ biến nhất là engine
 * Text-to-Speech mặc định của Android (Google Text-to-speech) dùng giọng
 * "network" cho một số ngôn ngữ — loại giọng này KHÔNG tổng hợp ngay trên
 * máy, mà phải gửi văn bản lên server Google rồi tải audio về mới phát
 * được, nên mỗi lần đọc đều tốn 1 vòng round-trip mạng (vài giây, tuỳ tốc
 * độ mạng), trong khi tiếng Việt trên cùng máy có thể đang dùng giọng
 * on-device nên không bị chậm. `Voice.identifier` của giọng "network" trên
 * Android luôn chứa chuỗi "network" (vd. "de-de-x-deb-network"). Ta dò một
 * lần, chọn sẵn giọng tiếng Đức KHÔNG phải "network" (ưu tiên Enhanced nếu
 * có) và dùng lại giọng đó cho MỌI lệnh đọc tiếng Đức sau này để tránh hẳn
 * độ trễ mạng — không ảnh hưởng gì trên máy vốn chỉ có giọng on-device
 * (kết quả dò ra vẫn là giọng duy nhất sẵn có, hành vi y như cũ).
 */
let germanVoiceId: string | null | undefined; // undefined = chưa dò, null = không có giọng local nào phù hợp

async function resolveLocalGermanVoice(): Promise<string | null> {
  if (germanVoiceId !== undefined) return germanVoiceId;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const deVoices = voices.filter((v) => v.language?.toLowerCase().startsWith('de'));
    const onDevice = deVoices.filter((v) => !v.identifier?.toLowerCase().includes('network'));
    const best = onDevice.find((v) => v.quality === 'Enhanced') || onDevice[0] || deVoices[0] || null;
    germanVoiceId = best?.identifier ?? null;
  } catch {
    // Máy/nền tảng không hỗ trợ liệt kê giọng (vd. một số bản Android cũ) —
    // bỏ qua, các lệnh đọc tiếng Đức vẫn hoạt động bằng giọng mặc định của
    // hệ thống như trước đây, chỉ là không tránh được giọng network nếu có.
    germanVoiceId = null;
  }
  return germanVoiceId;
}

/** Gắn `voice` (nếu đã dò được giọng local) vào options truyền cho Speech.speak, chỉ áp dụng cho tiếng Đức. */
function withGermanVoice(options: Speech.SpeechOptions): Speech.SpeechOptions {
  return germanVoiceId ? { ...options, voice: germanVoiceId } : options;
}

/**
 * "Làm nóng" giọng đọc tiếng Đức ngay khi app mở, KHÔNG phát tiếng gì nghe
 * được (âm lượng gần như câm) và KHÔNG đụng tới TrackPlayer/audio session
 * của "Nghe từ vựng" (xem lý do bỏ việc đó bên dưới).
 *
 * SỬA LỖI "phát âm thanh tiếng Đức bị chậm ~5 giây" TRÊN iOS (báo cáo trên
 * iOS 16.3.1 — chỉ tiếng Đức bị chậm, tiếng Việt vẫn bình thường): đây là
 * một hạn chế đã biết của chính AVSpeechSynthesizer/iOS (không phải lỗi do
 * app), được nhiều lập trình viên khác báo cáo cùng triệu chứng trên
 * developer.apple.com/forums/thread/715339 — dữ liệu "quy tắc phát âm"
 * (language rules) của tiếng Đức mà iOS phải nạp từ đĩa vào bộ nhớ trước
 * khi đọc được TO GẤP 5–9 LẦN so với tiếng Anh/Ý, nên lần đầu dùng giọng
 * tiếng Đức trong một phiên có thể mất 3–9 giây chỉ để nạp xong, trước khi
 * phát ra âm thanh nào — đúng khớp với triệu chứng "chỉ tiếng Đức chậm,
 * tiếng Việt (dữ liệu nhỏ hơn nhiều) vẫn nhanh trên CÙNG máy".
 *
 * Cách duy nhất giảm được độ trễ này từ phía app là ép iOS nạp trước dữ
 * liệu đó vào một thời điểm người dùng KHÔNG chờ đợi, thay vì để nó rơi
 * đúng lúc người dùng bấm nghe. `primeGermanVoice()` bên dưới làm việc đó
 * bằng cách đọc thử một câu tiếng Đức ngắn ở âm lượng gần như câm — được
 * gọi: (1) một lần khi app vừa mở (trong warmUpAudioSession), và (2) mỗi
 * khi app quay lại foreground sau khi bị đưa xuống nền (App.tsx, qua
 * AppState) — vì iOS có thể giải phóng dữ liệu đã nạp này khỏi bộ nhớ khi
 * app ở nền một lúc (đặc biệt trên các máy đời cũ chạy iOS 16 với RAM hạn
 * chế), khiến độ trễ quay lại ở lần đọc tiếng Đức tiếp theo.
 *
 * LƯU Ý QUAN TRỌNG: đây là chi phí có thật ở tầng hệ điều hành, không phải
 * do logic app chấm/gọi sai — nên biện pháp "nạp trước" chỉ CHE ĐƯỢC độ
 * trễ khi nó rơi đúng lúc app mở/quay lại nền (người dùng không để ý),
 * chứ không loại bỏ được hoàn toàn chi phí đó. Nếu độ trễ 5 giây vẫn lặp
 * lại ở MỌI lần bấm nghe dù app không hề rời khỏi foreground, nhiều khả
 * năng là do bộ nhớ máy bị áp lực mạnh (RAM thấp, nhiều app nền) khiến iOS
 * liên tục giải phóng rồi phải nạp lại dữ liệu này ngay trong một phiên —
 * trường hợp đó nằm ngoài khả năng khắc phục từ phía mã nguồn app.
 */
export async function warmUpAudioSession() {
  // (Đã bỏ việc gọi setupTrackPlayerOnce() sớm ở đây — TrackPlayer chỉ
  // thực sự cần cho "Nghe từ vựng" và tự khởi tạo đúng lúc đó qua
  // startKeepAliveAudio(). Gọi sớm không giúp ích gì cho AVSpeechSynthesizer
  // [đây là 2 audio session khác nhau trên iOS], mà chỉ khiến audio
  // session của app bị chiếm giữ ở category "Playback" ngay từ lúc mở app
  // dù chưa hề dùng "Nghe từ vựng" — một phần nguyên nhân góp phần vào độ
  // trễ phát âm tiếng Đức, xem thêm chú thích ở primeGermanVoice().)
  // Dò trước giọng tiếng Đức on-device (xem giải thích ở resolveLocalGermanVoice
  // phía trên) — làm TRƯỚC lượt "làm nóng" bên dưới để lượt làm nóng đó
  // cũng nạp đúng giọng sẽ dùng thật sự, tránh phải nạp lại 2 lần.
  await resolveLocalGermanVoice();
  primeGermanVoice();
}

/**
 * Đọc thử một câu tiếng Đức NGẮN, THẬT (không chỉ 1 ký tự) ở âm lượng gần
 * như câm, để ép AVSpeechSynthesizer nạp đầy đủ dữ liệu quy tắc phát âm
 * tiếng Đức — xem giải thích chi tiết ở warmUpAudioSession(). Dùng một câu
 * thật (thay vì dấu ".") vì engine có thể chỉ nạp một phần dữ liệu tương
 * ứng với độ dài/độ phức tạp văn bản được yêu cầu đọc; một câu ngắn thực
 * tế mô phỏng sát các lệnh đọc thật hơn một ký tự đơn lẻ.
 *
 * An toàn gọi lại nhiều lần (App.tsx gọi lại mỗi khi app quay lại
 * foreground) — nếu dữ liệu đã nạp sẵn trong bộ nhớ, lệnh đọc câm này gần
 * như không tốn gì; chỉ tốn thời gian thật khi iOS thực sự cần nạp lại.
 */
export function primeGermanVoice() {
  try {
    Speech.speak('Guten Tag, wie geht es dir', withGermanVoice({ language: 'de-DE', rate: 0.85, volume: 0.01 }));
  } catch {
    // ignore — chỉ là tối ưu, không phải điều kiện bắt buộc
  }
}

/**
 * index.html: speakText(text) — always German
 *
 * SỬA LỖI "phát âm tiếng Đức chậm ~5 giây Ở MỌI LẦN BẤM, kể cả khi dùng
 * liên tục" (không chỉ lần đầu/sau khi mở lại app): trước đây hàm này gọi
 * `Speech.stop()` VÔ ĐIỀU KIỆN ngay trước MỌI lần `Speech.speak()`, kể cả
 * khi không hề có gì đang phát (trường hợp phổ biến nhất: người dùng bấm
 * nghe 1 từ trong lúc im lặng). `stop()` trên iOS không phải thao tác
 * miễn phí khi có gọi thật sự — nó buộc AVSpeechSynthesizer ngắt/giải
 * phóng phiên tổng hợp giọng đang giữ, khiến lệnh `speak()` NGAY SAU ĐÓ
 * phải khởi tạo lại từ đầu, bao gồm nạp lại dữ liệu quy tắc phát âm của
 * ngôn ngữ đó — với tiếng Đức (nặng gấp 5–9 lần tiếng Anh/Ý, xem chú thích
 * ở warmUpAudioSession) chi phí này rơi vào khoảng vài giây, LẶP LẠI ở
 * MỌI lần gọi vì luôn có `stop()` phía trước dù không cần thiết. Tiếng
 * Việt (dữ liệu nhỏ hơn nhiều) chịu đúng cơ chế này nhưng không đủ lớn để
 * người dùng nhận ra.
 *
 * Chỉ gọi `stop()` khi THỰC SỰ đang có câu nói dở dang cần ngắt (người
 * dùng bấm nghe từ mới trong lúc từ cũ chưa đọc xong) — trường hợp còn
 * lại (phổ biến hơn nhiều) bỏ qua hẳn `stop()`, để AVSpeechSynthesizer giữ
 * nguyên phiên đã "nóng sẵn" từ lần đọc trước, tránh khởi tạo lại từ đầu.
 */
export async function speakText(text: string) {
  if (!soundEnabledRef || !text?.trim()) return;
  if (await Speech.isSpeakingAsync()) Speech.stop();
  Speech.speak(
    text.trim(),
    withGermanVoice({
      language: 'de-DE',
      rate: 0.85, // matches original utt.rate = 0.85
      pitch: 1,
    })
  );
}

/**
 * index.html: speakForMode(q) — "Nghe" mode: what gets SPOKEN is always the
 * PROMPT (the thing the person is given), never the target they must type.
 *  - fullWord  ("nghe - nguyên từ"): mục tiêu là gõ NGUYÊN TỪ, nên phát âm
 *    thanh là NGHĨA tiếng Việt (vi-VN).
 *  - fullMeaning ("nghe - nghĩa"): mục tiêu là gõ NGHĨA, nên phát âm thanh
 *    là NGUYÊN TỪ tiếng Đức (de-DE).
 *  - fullSentence: giữ nguyên — luôn đọc câu ví dụ tiếng Đức.
 */
export function speakForMode(q: Question, effectiveType: Exclude<ExerciseType, 'mixedRandom'>, strictVocabCheck: boolean) {
  if (!q) return;
  if (effectiveType === 'fullSentence') {
    speakText(q.example ? getGermanExample(q.example) : q.fullDisplayGerman);
    return;
  }
  if (effectiveType === 'fullWord') {
    speakTextVi(q.meaning);
    return;
  }
  const reduced = getReducedTarget(q.fullDisplayGerman, strictVocabCheck);
  speakText(reduced !== null ? reduced : q.fullDisplayGerman);
}

/** Same as speakText but for Vietnamese (nghĩa) — used by "nghe - nguyên từ" mode. */
export async function speakTextVi(text: string) {
  if (!soundEnabledRef || !text?.trim()) return;
  if (await Speech.isSpeakingAsync()) Speech.stop();
  Speech.speak(text.trim(), {
    language: 'vi-VN',
    rate: 0.85,
    pitch: 1,
  });
}

/**
 * Phát một đoạn văn bản đơn lẻ trong hàng đợi tuần tự dùng cho "Nghe từ
 * vựng" — không kiểm tra soundEnabledRef (chế độ nghe có công tắc riêng),
 * luôn gọi đúng một trong các callback khi kết thúc để bên gọi (hook
 * useListenMode) có thể nối sang mục tiếp theo.
 */
export function speakQueueItem(
  text: string,
  language: 'de-DE' | 'vi-VN',
  rate: number,
  callbacks: { onDone: () => void; onError?: () => void }
) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    callbacks.onDone();
    return;
  }
  const baseOptions: Speech.SpeechOptions = {
    language,
    rate,
    pitch: 1,
    onDone: callbacks.onDone,
    onStopped: () => {}, // dừng chủ động (pause/next/prev) — hook tự quản lý, không gọi tiếp ở đây
    onError: () => {
      callbacks.onError?.();
      callbacks.onDone();
    },
  };
  Speech.speak(trimmed, language === 'de-DE' ? withGermanVoice(baseOptions) : baseOptions);
}

export function stopSpeaking() {
  Speech.stop();
}
