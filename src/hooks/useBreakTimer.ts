import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '@/store/SettingsContext';
import { useToast } from '@/store/ToastContext';

/**
 * Break timer — ports startBreakWorkTimer/showBreakOverlay/hideBreakOverlay/
 * restartBreakCycle (index.html ~4688-4822).
 *
 * DEVIATION: the original's overlay plays a looping cat video
 * (neko1.webm slide-in → neko2.webm loop) on desktop, but explicitly SKIPS
 * the video entirely on mobile width (`isMobileBreak` branch — just pauses/
 * unloads the video, showing only the countdown). Since this app IS the
 * mobile build, we only need to port that mobile branch: a plain countdown
 * overlay, no video assets. (.webm also isn't a supported RN video format
 * without extra native modules, so this also avoids an unnecessary
 * dependency for a codepath the original doesn't even use on mobile.)
 */
export function useBreakTimer() {
  const { breakEnabled, breakWorkMinutes, breakRestMinutes } = useSettings();
  const { showToast } = useToast();

  const [isBreakActive, setIsBreakActive] = useState(false);
  const [remainingSec, setRemainingSec] = useState(0);

  const workTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breakActiveRef = useRef(false);

  const stopBreakWorkTimer = useCallback(() => {
    if (workTimerRef.current) {
      clearTimeout(workTimerRef.current);
      workTimerRef.current = null;
    }
  }, []);

  const showBreakOverlay = useCallback(() => {
    breakActiveRef.current = true;
    setIsBreakActive(true);
    const total = Math.max(1, breakRestMinutes) * 60;
    setRemainingSec(total);

    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          breakActiveRef.current = false;
          setIsBreakActive(false);
          showToast('Hết giờ nghỉ, tiếp tục học nào!', 'check-circle');
          // index.html: hideBreakOverlay() ends by restarting the work cycle
          startBreakWorkTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakRestMinutes, showToast]);

  const startBreakWorkTimer = useCallback(() => {
    stopBreakWorkTimer();
    if (!breakEnabled || breakActiveRef.current) return;
    const ms = Math.max(1, breakWorkMinutes) * 60 * 1000;
    workTimerRef.current = setTimeout(showBreakOverlay, ms);
  }, [breakEnabled, breakWorkMinutes, showBreakOverlay, stopBreakWorkTimer]);

  // index.html: restartBreakCycle() — called whenever break settings change
  useEffect(() => {
    stopBreakWorkTimer();
    if (breakEnabled && !breakActiveRef.current) startBreakWorkTimer();
    return () => {
      stopBreakWorkTimer();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakEnabled, breakWorkMinutes, breakRestMinutes]);

  function formatBreakTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  }

  return {
    isBreakActive,
    remainingSec,
    formattedTime: formatBreakTime(remainingSec),
  };
}
