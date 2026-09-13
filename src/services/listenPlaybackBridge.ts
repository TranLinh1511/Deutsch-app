/**
 * Cầu nối giữa PlaybackService (headless, chạy NGOÀI cây React — xem
 * index.js/playbackService.ts) và bộ điều khiển thật của "Nghe từ vựng"
 * đang sống trong useListenMode (bên trong ListenModeProvider).
 *
 * TrackPlayer chỉ dùng để: (1) giữ một foreground service + thông báo thật
 * trên Android, nhờ đó JS không bị hệ điều hành Doze/treo khi tắt màn
 * hình, và (2) hiện nút play/pause/next/prev trên thông báo & khoá màn
 * hình. Khi người dùng bấm các nút đó, sự kiện Remote* bắn ra được xử lý ở
 * playbackService.ts — nhưng service đó không có quyền truy cập trực tiếp
 * vào state/hook của React, nên nó gọi qua các callback đăng ký ở đây.
 */
type Controls = {
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
};

let controls: Controls | null = null;

/** Gọi từ ListenModeProvider mỗi khi các hàm điều khiển đổi (useEffect). */
export function registerListenControls(next: Controls | null) {
  controls = next;
}

export function bridgePlay() {
  controls?.play();
}
export function bridgePause() {
  controls?.pause();
}
export function bridgeNext() {
  controls?.next();
}
export function bridgePrev() {
  controls?.prev();
}
