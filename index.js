/**
 * Entry point tự viết — thay cho node_modules/expo/AppEntry.js mặc định.
 *
 * LÝ DO CẦN FILE NÀY: react-native-track-player yêu cầu gọi
 * TrackPlayer.registerPlaybackService(...) ở TOP-LEVEL của entry point,
 * NGOÀI cây React — đây là cách RN đăng ký một "headless JS task" mà hệ
 * điều hành Android có thể khởi chạy độc lập (để xử lý sự kiện điều khiển
 * từ thông báo/khoá màn hình ngay cả khi UI app chưa render xong). Không
 * thể đặt lời gọi này bên trong component/useEffect.
 */
import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { PlaybackService } from './src/services/playbackService';

// registerRootComponent tương đương AppRegistry.registerComponent('main', ...)
// mà expo/AppEntry.js làm — giữ nguyên hành vi gốc, chỉ thêm bước đăng ký
// playback service ở dưới.
registerRootComponent(App);

TrackPlayer.registerPlaybackService(() => PlaybackService);
