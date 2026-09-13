import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Same project as Login.html / index.html (const firebaseConfig / _app).
 * Kept identical so the RN app talks to the exact same Firestore data —
 * no migration needed, per prompt section 6.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyAF016vyl1zZ7dSTpmMZkj8BhCQVwmELl0',
  authDomain: 'deutschbei-tl.firebaseapp.com',
  projectId: 'deutschbei-tl',
  storageBucket: 'deutschbei-tl.firebasestorage.app',
  messagingSenderId: '698311590550',
  appId: '1:698311590550:web:fd9006993fb023641138b7',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// initializeAuth throws if called twice (e.g. Fast Refresh) — fall back to getAuth.
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

/**
 * SỬA LỖI "MẠNG TRONG APP CHẬM" (dù mạng máy hoàn toàn bình thường):
 * getFirestore() mặc định dùng kênh WebChannel streaming — kiểu kết nối
 * vốn được thiết kế cho trình duyệt web, KHÔNG được React Native/Hermes hỗ
 * trợ đầy đủ. Mỗi lần Firestore cần mở kết nối (mở app, getDocs,
 * onSnapshot...), SDK phải thử WebChannel trước, đợi timeout dò lỗi, rồi
 * mới tự rơi về long-polling — tốn thêm vài giây MỖI LẦN, gây cảm giác
 * "mạng trong app chậm" trong khi mạng thật của máy không hề chậm.
 *
 * initializeFirestore với experimentalAutoDetectLongPolling: true buộc
 * SDK tự phát hiện môi trường không hỗ trợ streaming và dùng long-polling
 * NGAY TỪ ĐẦU, bỏ qua bước dò/timeout đó.
 *
 * initializeFirestore CHỈ được gọi 1 lần cho mỗi app (giống
 * initializeAuth) — try/catch rơi về getFirestore cho trường hợp Fast
 * Refresh lúc dev gọi lại nhiều lần.
 */
let db;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false,
  });
} catch {
  db = getFirestore(app);
}

export { app, auth, db };
