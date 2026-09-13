import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VocabWord } from '@/types/models';

/**
 * "Thông báo từ vựng ngẫu nhiên" — thông báo cục bộ (local notification,
 * không cần server/push), LẶP LẠI SAU MỖI N PHÚT, nội dung là một từ ngẫu
 * nhiên rút từ phiên đang học.
 *
 * ĐÃ SỬA (trước đây dùng 1 thông báo "repeats: true" kiểu TimeInterval —
 * hệ điều hành chỉ chốt NỘI DUNG một lần duy nhất lúc lên lịch rồi lặp lại
 * ĐÚNG thông báo đó mãi mãi, nên người dùng thấy lặp đi lặp lại y hệt 1
 * từ, và nếu không mở app đúng lúc để reschedule thì từ hiển thị cũng
 * không còn khớp với phiên đang học nữa → "không thông báo đúng"):
 *
 * Giờ lên lịch trước MỘT LOẠT thông báo KHÔNG lặp (mỗi cái 1 lần, giờ bắn
 * khác nhau, cách nhau đúng intervalMinutes), mỗi thông báo tự bốc 1 từ
 * ngẫu nhiên RIÊNG — và cố tránh bốc trùng từ vừa chọn ngay trước đó (nếu
 * phiên có từ 2 trở lên) để không bị 2 thông báo liền kề đọc cùng 1 từ.
 * Khi hàng đợi sắp cạn (hoặc mỗi lần mở lại app), tự động lên lịch bù
 * thêm — nhờ vậy nội dung luôn "tươi" và đúng ngẫu nhiên ở MỌI lần bắn,
 * không cần phụ thuộc việc mở app đúng chu kỳ như trước.
 */

const SCHEDULED_IDS_KEY = 'beitl_notif_scheduled_ids'; // JSON string[] các id thông báo đang chờ bắn
const QUEUE_RUNS_OUT_AT_KEY = 'beitl_notif_queue_runs_out_at_ms'; // thời điểm thông báo CUỐI trong hàng đợi sẽ bắn
const LAST_WORD_KEY = 'beitl_notif_last_word'; // từ tiếng Đức vừa được chọn lần gần nhất, để tránh chọn trùng liền kề
const ANDROID_CHANNEL_ID = 'vocab-reminder';

export const NOTIF_INTERVAL_MIN_MINUTES = 15;
export const NOTIF_INTERVAL_MAX_MINUTES = 24 * 60; // 24 giờ

// Số thông báo lên lịch trước mỗi đợt. Đủ để người dùng không mở app
// trong 1-2 ngày vẫn còn thông báo mới (khác từ) chờ sẵn, nhưng không quá
// nhiều để tránh chiếm hết quota lên lịch của hệ điều hành (iOS giới hạn
// 64 thông báo cục bộ đang chờ cho MỖI app).
const BATCH_SIZE = 24;
// Khi số thông báo còn lại trong hàng đợi <= ngưỡng này, coi như "sắp cạn"
// và cần lên lịch bù thêm ngay khi có cơ hội (mở app).
const REFILL_THRESHOLD = 4;

// shouldShowAlert: false — "Thông báo từ vựng ngẫu nhiên" không hiển thị
// popup/alert nổi lên trong app nữa. Thông báo vẫn được lên lịch và vẫn
// xuất hiện bình thường trong trung tâm thông báo của hệ điều hành khi app
// ở nền/tắt; chỉ tắt phần popup chồng lên màn hình lúc app đang mở.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function germanOf(word: VocabWord): string {
  return (word.originalGerman || word.mainGerman || '').trim();
}

/**
 * Bốc 1 từ ngẫu nhiên trong `pool`, tránh trùng `avoidGerman` (từ vừa chọn
 * ngay trước đó) nếu pool có từ 2 trở lên usable — để 2 thông báo liền kề
 * không đọc lặp cùng 1 từ.
 */
function pickRandomWord(pool: VocabWord[], avoidGerman: string | null): VocabWord | null {
  const usable = pool.filter((w) => germanOf(w));
  if (!usable.length) return null;
  if (usable.length === 1 || !avoidGerman) {
    return usable[Math.floor(Math.random() * usable.length)];
  }
  const candidates = usable.filter((w) => germanOf(w) !== avoidGerman);
  const from = candidates.length ? candidates : usable;
  return from[Math.floor(Math.random() * from.length)];
}

/** Xin quyền thông báo (iOS) + tạo kênh thông báo (Android 8+). */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Nhắc từ vựng',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return status === 'granted';
}

/** Huỷ TOÀN BỘ thông báo đang lên lịch (nếu có) — gọi khi tắt tính năng. */
export async function cancelVocabNotification(): Promise<void> {
  const raw = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
  if (raw) {
    let ids: string[] = [];
    try {
      ids = JSON.parse(raw);
    } catch {
      ids = [];
    }
    await Promise.all(
      ids.map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {
          // Đã bị huỷ/không còn tồn tại — bỏ qua.
        })
      )
    );
    await AsyncStorage.removeItem(SCHEDULED_IDS_KEY);
  }
  await AsyncStorage.removeItem(QUEUE_RUNS_OUT_AT_KEY);
  await AsyncStorage.removeItem(LAST_WORD_KEY);
}

/**
 * Huỷ hàng đợi cũ (nếu có) rồi lên lịch trước một loạt `BATCH_SIZE` thông
 * báo KHÔNG lặp, mỗi cái bắn cách nhau `intervalMinutes` phút tính từ bây
 * giờ, mỗi cái tự bốc 1 từ ngẫu nhiên riêng (tránh trùng từ liền kề).
 * Trả về false nếu không xin được quyền hoặc phiên hiện không có từ nào.
 */
export async function rescheduleVocabNotification(
  pool: VocabWord[],
  intervalMinutes: number
): Promise<boolean> {
  const granted = await ensureNotificationPermission();
  if (!granted) return false;
  if (!pool.some((w) => germanOf(w))) return false;

  await cancelVocabNotification();

  const clampedMinutes = Math.max(NOTIF_INTERVAL_MIN_MINUTES, Math.min(NOTIF_INTERVAL_MAX_MINUTES, intervalMinutes));
  const ids: string[] = [];
  let lastGerman: string | null = null;
  const now = Date.now();

  for (let i = 1; i <= BATCH_SIZE; i++) {
    const word = pickRandomWord(pool, lastGerman);
    if (!word) break;
    const german = germanOf(word);
    lastGerman = german;
    const fireDate = new Date(now + i * clampedMinutes * 60 * 1000);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Ôn từ vựng ngẫu nhiên',
        body: word.meaning ? `${german} — ${word.meaning}` : german,
      },
      trigger: {
        date: fireDate,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      } as Notifications.NotificationTriggerInput,
    });
    ids.push(id);
  }

  if (!ids.length) return false;

  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
  await AsyncStorage.setItem(QUEUE_RUNS_OUT_AT_KEY, String(now + ids.length * clampedMinutes * 60 * 1000));
  if (lastGerman) await AsyncStorage.setItem(LAST_WORD_KEY, lastGerman);
  return true;
}

/**
 * True nếu hàng đợi thông báo đã lên lịch sắp cạn (còn ít hơn
 * REFILL_THRESHOLD lượt bắn nữa) hoặc chưa từng lên lịch — dùng để biết
 * khi nào cần bù thêm một đợt mới lúc app quay lại foreground, TRƯỚC khi
 * hàng đợi bắn hết (khác với trước đây, vốn chỉ reschedule SAU khi đã
 * trôi qua nguyên 1 chu kỳ và luôn lặp lại đúng 1 từ cũ trong lúc chờ).
 */
export async function needsIntervalRebuild(intervalMinutes: number): Promise<boolean> {
  const raw = await AsyncStorage.getItem(QUEUE_RUNS_OUT_AT_KEY);
  if (!raw) return true;
  const runsOutAt = parseInt(raw, 10);
  if (Number.isNaN(runsOutAt)) return true;
  const clampedMinutes = Math.max(NOTIF_INTERVAL_MIN_MINUTES, Math.min(NOTIF_INTERVAL_MAX_MINUTES, intervalMinutes));
  const refillBeforeMs = REFILL_THRESHOLD * clampedMinutes * 60 * 1000;
  return Date.now() >= runsOutAt - refillBeforeMs;
}
