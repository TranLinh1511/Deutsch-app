import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setTtsSoundEnabled } from '@/services/tts';
import { useDataStore } from '@/store/DataStore';
import {
  rescheduleVocabNotification,
  cancelVocabNotification,
  needsIntervalRebuild,
  NOTIF_INTERVAL_MIN_MINUTES,
  NOTIF_INTERVAL_MAX_MINUTES,
} from '@/services/vocabNotifications';

/**
 * Settings store — index.html's global vars `soundEnabled`, `breakEnabled`,
 * `breakWorkMinutes`, `breakRestMinutes` (settings panel, ~line 3160-3190
 * "Nghỉ giải lao" section). Per-exercise settings (studyMode, allowSkip,
 * randomMode, strictVocabCheck, autoAdvanceOnCorrect, onlyUnmastered,
 * wordLimit) stay inside usePracticeEngine (Phase 5) since they're
 * per-practice-session state, not persisted global preferences in the
 * original either — SettingsModal (this phase) just exposes both groups
 * together in one panel, same as the original's single settings sidebar.
 *
 * "Thông báo từ vựng ngẫu nhiên" (mới): nhắc ôn bài LẶP LẠI SAU MỖI N PHÚT
 * (không phải 1 giờ cố định trong ngày), đọc SANG một từ ngẫu nhiên rút từ
 * phiên đang học (vocab/mergedVocab của DataStore — cùng danh sách mà
 * MainScreen dùng để luyện tập). Đặt ở đây (không phải usePracticeEngine)
 * vì đây là một cài đặt toàn cục, sống độc lập với màn hình luyện tập đang
 * mở hay không — SettingsProvider nằm bên trong DataStoreProvider (xem
 * App.tsx) nên gọi được useDataStore(). Chi tiết vì sao "ngẫu nhiên" chỉ
 * thực sự đổi mỗi chu kỳ khi mở lại app: xem services/vocabNotifications.ts.
 */
interface SettingsContextValue {
  soundEnabled: boolean;
  toggleSound: () => void;
  breakEnabled: boolean;
  setBreakEnabled: (v: boolean) => void;
  breakWorkMinutes: number;
  setBreakWorkMinutes: (n: number) => void;
  breakRestMinutes: number;
  setBreakRestMinutes: (n: number) => void;
  notifEnabled: boolean;
  setNotifEnabled: (v: boolean) => void;
  notifIntervalMinutes: number;
  setNotifIntervalMinutes: (n: number) => void;
  // Item 3: tự động ẩn khối "Gợi ý" mỗi khi chuyển sang từ khác (đúng/sai/
  // bỏ qua/lùi lại) — tránh gợi ý của từ CŨ còn hiển thị lộ ra khi câu MỚI
  // vừa xuất hiện.
  autoHideHint: boolean;
  setAutoHideHint: (v: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const KEYS = {
  sound: 'beitl_sound_enabled',
  breakEnabled: 'breakEnabled',
  breakWork: 'breakWorkMinutes',
  breakRest: 'breakRestMinutes',
  notifEnabled: 'beitl_notif_enabled',
  notifIntervalMinutes: 'beitl_notif_interval_minutes',
  autoHideHint: 'beitl_auto_hide_hint',
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [breakEnabled, setBreakEnabledState] = useState(false);
  const [breakWorkMinutes, setBreakWorkMinutesState] = useState(25);
  const [breakRestMinutes, setBreakRestMinutesState] = useState(5);
  const [notifEnabled, setNotifEnabledState] = useState(false);
  const [notifIntervalMinutes, setNotifIntervalMinutesState] = useState(60);
  const [autoHideHint, setAutoHideHintState] = useState(false);

  const { vocab, mergedVocab, source } = useDataStore();
  const pool = source === 'merged' ? mergedVocab : vocab;
  // Ref để effect theo dõi AppState đọc được danh sách từ MỚI NHẤT mà
  // không cần add vào dependency array (tránh đăng ký/gỡ listener liên tục
  // mỗi khi vocab đổi trong lúc đang gõ/luyện tập).
  const poolRef = useRef(pool);
  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  useEffect(() => {
    (async () => {
      const [s, be, bw, br, ne, ni, ahh] = await Promise.all([
        AsyncStorage.getItem(KEYS.sound),
        AsyncStorage.getItem(KEYS.breakEnabled),
        AsyncStorage.getItem(KEYS.breakWork),
        AsyncStorage.getItem(KEYS.breakRest),
        AsyncStorage.getItem(KEYS.notifEnabled),
        AsyncStorage.getItem(KEYS.notifIntervalMinutes),
        AsyncStorage.getItem(KEYS.autoHideHint),
      ]);
      const soundOn = s !== 'false';
      setSoundEnabled(soundOn);
      setTtsSoundEnabled(soundOn);
      setBreakEnabledState(be === 'true');
      if (bw) setBreakWorkMinutesState(parseInt(bw, 10) || 25);
      if (br) setBreakRestMinutesState(parseInt(br, 10) || 5);
      setNotifEnabledState(ne === 'true');
      if (ni != null) {
        const n = parseInt(ni, 10);
        if (!Number.isNaN(n)) {
          setNotifIntervalMinutesState(Math.max(NOTIF_INTERVAL_MIN_MINUTES, Math.min(NOTIF_INTERVAL_MAX_MINUTES, n)));
        }
      }
      setAutoHideHintState(ahh === 'true');
    })();
  }, []);

  // Bật/tắt hoặc đổi số phút → lên lịch lại ngay (chọn 1 từ ngẫu nhiên mới
  // từ phiên đang học) hoặc huỷ hẳn nếu tắt.
  useEffect(() => {
    if (!notifEnabled) {
      cancelVocabNotification();
      return;
    }
    if (!pool.length) return;
    rescheduleVocabNotification(pool, notifIntervalMinutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifEnabled, notifIntervalMinutes, pool]);

  // Mỗi lần app quay lại foreground, nếu đang bật và hàng đợi thông báo đã
  // lên lịch sắp cạn (xem needsIntervalRebuild trong vocabNotifications.ts)
  // thì bù thêm 1 đợt thông báo mới (mỗi cái đã tự chọn sẵn 1 từ ngẫu
  // nhiên riêng, không cần chờ tới lúc bắn mới chọn). Không có gì để làm
  // nếu hàng đợi còn nhiều.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || !notifEnabled) return;
      if (!poolRef.current.length) return;
      if (await needsIntervalRebuild(notifIntervalMinutes)) {
        rescheduleVocabNotification(poolRef.current, notifIntervalMinutes);
      }
    });
    return () => sub.remove();
  }, [notifEnabled, notifIntervalMinutes]);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      setTtsSoundEnabled(next);
      AsyncStorage.setItem(KEYS.sound, next ? 'true' : 'false');
      return next;
    });
  };

  const setBreakEnabled = (v: boolean) => {
    setBreakEnabledState(v);
    AsyncStorage.setItem(KEYS.breakEnabled, v ? 'true' : 'false');
  };
  const setBreakWorkMinutes = (n: number) => {
    setBreakWorkMinutesState(n);
    AsyncStorage.setItem(KEYS.breakWork, String(n));
  };
  const setBreakRestMinutes = (n: number) => {
    setBreakRestMinutesState(n);
    AsyncStorage.setItem(KEYS.breakRest, String(n));
  };

  const setNotifEnabled = (v: boolean) => {
    setNotifEnabledState(v);
    AsyncStorage.setItem(KEYS.notifEnabled, v ? 'true' : 'false');
  };
  const setNotifIntervalMinutes = (n: number) => {
    const clamped = Math.max(NOTIF_INTERVAL_MIN_MINUTES, Math.min(NOTIF_INTERVAL_MAX_MINUTES, Math.round(n)));
    setNotifIntervalMinutesState(clamped);
    AsyncStorage.setItem(KEYS.notifIntervalMinutes, String(clamped));
  };

  const setAutoHideHint = (v: boolean) => {
    setAutoHideHintState(v);
    AsyncStorage.setItem(KEYS.autoHideHint, v ? 'true' : 'false');
  };

  return (
    <SettingsContext.Provider
      value={{
        soundEnabled,
        toggleSound,
        breakEnabled,
        setBreakEnabled,
        breakWorkMinutes,
        setBreakWorkMinutes,
        breakRestMinutes,
        setBreakRestMinutes,
        notifEnabled,
        setNotifEnabled,
        notifIntervalMinutes,
        setNotifIntervalMinutes,
        autoHideHint,
        setAutoHideHint,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
