import { useCallback, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionErrorCode,
} from 'expo-speech-recognition';

export type SpeechRecognizerStatus = 'idle' | 'listening';
export type SpeechLang = 'de-DE' | 'vi-VN';

interface UseSpeechRecognizerOptions {
  onResult: (transcript: string) => void;
  onError?: (message: string) => void;
}

// Android/iOS trả lỗi bằng mã tiếng Anh chung chung (vd. "client" ↔
// SpeechRecognizer.ERROR_CLIENT, hiện nguyên văn "Other client side
// errors." — không nói rõ nguyên nhân). Dịch sang tiếng Việt DỄ HIỂU và
// gợi ý hướng xử lý, thay vì hiện nguyên văn thông báo hệ thống.
const ERROR_MESSAGES: Partial<Record<ExpoSpeechRecognitionErrorCode, string>> = {
  'not-allowed': 'Chưa cấp quyền micro/nhận diện giọng nói cho ứng dụng.',
  'service-not-allowed': 'Máy không có sẵn dịch vụ nhận diện giọng nói (thường do thiếu app Google).',
  'language-not-supported': 'Máy chưa hỗ trợ nhận diện ngôn ngữ này.',
  network: 'Không có mạng để nhận diện giọng nói — thử lại khi có Wi-Fi/dữ liệu di động.',
  'audio-capture': 'Không ghi được âm thanh từ micro — kiểm tra micro có bị ứng dụng khác chiếm dụng không.',
  busy: 'Bộ nhận diện giọng nói đang bận — đợi 1 chút rồi thử lại.',
  aborted: 'Đã huỷ ghi âm.',
  // "client": lỗi gộp chung phía Android khi không khởi động được phiên
  // nghe (thường do app Google chưa được cấp quyền Micro riêng, hoặc bị
  // ROM tuỳ biến (Xiaomi/Oppo/Vivo...) chặn quyền nền) — không phải lỗi
  // logic của app, chỉ đoán được nguyên nhân phổ biến nhất để gợi ý.
  client: 'Máy không khởi động được micro nhận diện giọng nói. Thử kiểm tra: app "Google" đã được cấp quyền Micro riêng trong Cài đặt hệ thống chưa, hoặc thử trên máy khác.',
};

function toFriendlyMessage(code: ExpoSpeechRecognitionErrorCode, rawMessage: string): string {
  return ERROR_MESSAGES[code] || rawMessage || 'Có lỗi khi nhận diện giọng nói, thử lại.';
}

/**
 * Bọc expo-speech-recognition — nhận diện giọng nói NGAY TRÊN THIẾT BỊ
 * (SFSpeechRecognizer trên iOS, SpeechRecognizer của Android), không gửi
 * audio lên server nào cả, không tốn phí.
 *
 * Dùng cho chế độ luyện "Phát âm": chỉ cần biết người dùng có NÓI RA ĐÚNG
 * TỪ hay không (so khớp văn bản qua checkWriteAnswer/isMeaningMatch/
 * isSentenceMatch — dùng lại y hệt logic chấm của chế độ Viết), KHÔNG chấm
 * điểm phát âm chi tiết theo từng âm/âm tiết — đó là bài toán khác (cần
 * dịch vụ cloud như Azure Pronunciation Assessment), ngoài phạm vi ở đây.
 */
export function useSpeechRecognizer({ onResult, onError }: UseSpeechRecognizerOptions) {
  const [status, setStatus] = useState<SpeechRecognizerStatus>('idle');
  // Dùng ref để luôn gọi đúng callback MỚI NHẤT (currentQuestion đổi liên
  // tục) mà không phải huỷ-đăng-ký-lại listener của thư viện mỗi lần đổi câu.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useSpeechRecognitionEvent('start', () => setStatus('listening'));
  useSpeechRecognitionEvent('end', () => setStatus('idle'));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) onResultRef.current(transcript);
  });
  useSpeechRecognitionEvent('error', (event) => {
    setStatus('idle');
    // "no-speech": im lặng quá lâu / không nói gì — không phải lỗi thật sự
    // (người dùng có thể chỉ đang chần chừ), bỏ qua thay vì làm phiền bằng
    // thông báo lỗi.
    if (event.error === 'no-speech') return;
    onErrorRef.current?.(toFriendlyMessage(event.error, event.message));
  });

  const start = useCallback(async (lang: SpeechLang) => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      onErrorRef.current?.('Chưa cấp quyền micro/nhận diện giọng nói.');
      return;
    }
    // Kiểm tra trước khi start() để báo lỗi rõ ràng ngay, thay vì chờ native
    // trả về mã lỗi chung chung "client"/"service-not-allowed" sau đó.
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      onErrorRef.current?.(
        'Máy này không có sẵn dịch vụ nhận diện giọng nói (thường do thiếu/chưa cập nhật app Google).'
      );
      return;
    }
    try {
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: false,
        continuous: false,
      });
    } catch {
      onErrorRef.current?.('Không khởi động được micro, thử lại.');
    }
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { status, start, stop };
}
