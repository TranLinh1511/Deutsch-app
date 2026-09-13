import TrackPlayer, { Event } from 'react-native-track-player';
import { bridgeNext, bridgePause, bridgePlay, bridgePrev } from './listenPlaybackBridge';

/**
 * Headless playback service của react-native-track-player — bắt các sự
 * kiện điều khiển đến từ thông báo Android / khoá màn hình / tai nghe
 * bluetooth và nối sang bộ điều khiển thật của "Nghe từ vựng" (qua
 * listenPlaybackBridge, vì service này chạy ngoài cây React).
 *
 * Bản thân TrackPlayer chỉ phát 1 track "câm" lặp vô hạn để giữ foreground
 * service + thông báo tồn tại — giọng đọc thật vẫn do expo-speech đảm
 * nhiệm (xem services/tts.ts). Play/pause ở đây điều khiển "Nghe từ vựng"
 * (bật/tắt cả track câm lẫn giọng đọc), không phải điều khiển bản thân
 * track câm.
 */
export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => bridgePlay());
  TrackPlayer.addEventListener(Event.RemotePause, () => bridgePause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => bridgePause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => bridgeNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => bridgePrev());
  // Nút "x" trên thông báo / tai nghe rút ra — coi như bấm pause.
  TrackPlayer.addEventListener(Event.RemoteDuck, (e) => {
    if (e.paused || e.permanent) bridgePause();
  });
}
