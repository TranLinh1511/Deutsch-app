import { useSyncExternalStore } from 'react';

/**
 * Store nhỏ ngoài React giữ chữ người dùng đang gõ.
 *
 * VÌ SAO CẦN: trước đây `answerValue` là useState trong usePracticeEngine →
 * mỗi phím gõ làm CẢ MainScreen (+ Settings/Folder/Bulk modal, thẻ câu hỏi,
 * thanh stats...) render lại → gõ bị đơ/giật. Giờ chỉ những component thực sự
 * đọc chữ đang gõ (ô nhập, khối gợi ý, ô hiển thị kết quả nói) đăng ký theo
 * dõi store này; MainScreen và phần còn lại KHÔNG render lại theo từng phím.
 */
export interface AnswerStore {
  get: () => string;
  set: (v: string) => void;
  subscribe: (l: () => void) => () => void;
}

export function createAnswerStore(): AnswerStore {
  let value = '';
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (v) => {
      if (v === value) return;
      value = v;
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

export function useAnswerValue(store: AnswerStore): string {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
