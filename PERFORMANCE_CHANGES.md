# Thay đổi hiệu năng (gõ giật + load chậm)

## Gõ giật
- `src/hooks/answerStore.ts` (MỚI): chữ đang gõ nằm ngoài React state.
- `usePracticeEngine.ts`: bỏ `useState(answerValue)`, dùng `answerStore`; ghi tiến trình học xuống AsyncStorage có debounce 700ms.
- `ExerciseAnswerInput.tsx`: tự đọc store; viền động chuyển sang View bọc ngoài (TextInput thường, không còn Animated TextInput).
- `HintBox.tsx` (MỚI): khối gợi ý tự theo dõi store.
- `SpeakAnswerInput.tsx`, `MainScreen.tsx`: nhận `store`, MainScreen không còn render lại theo từng phím.

## Load chậm
- `firebase/config.ts`: `experimentalForceLongPolling: true` (thay cho auto-detect).
- `services/cache.ts`: không xoá cache từ vựng ở mỗi lần mở app nữa (chỉ khi đổi CACHE_SCHEMA_VERSION).
- `firebase/words.ts`, `masteredFlagged.ts`, `sessions.ts`: stale-while-revalidate (hiện cache ngay, tải nền, khác thì cập nhật qua `revalidate.ts`).
- `DataStore.tsx`: bootstrap song song, folders không chặn, gộp phiên tải song song, `useMemo` cho context value, sửa closure cũ của `onRemoteUpdate`.
- `AuthContext.tsx`: vào app ngay, đọc tên hiển thị ở nền.
- `Toast/Dialogs/Theme/Settings Context`: memo hoá value, ổn định hàm.
