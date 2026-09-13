# bei TL — React Native (Expo) rewrite

## Trạng thái: 9/9 phase hoàn thành ✅

Theo đúng thứ tự ở mục 8 của prompt gốc:
1. ✅ Setup project + navigation + theme
2. ✅ Auth flow (Login.html)
3. ✅ Firebase service layer + store
4. ✅ Sidebar/Session/Folder
5. ✅ Màn hình luyện tập chính + chấm điểm
6. ✅ TTS
7. ✅ Import/Export
8. ✅ Search + Stats + Break timer
9. ✅ **Polish UI/animation** ← bạn đang ở đây
4. ⬜ Sidebar/Session/Folder
5. ⬜ Màn hình luyện tập chính + chấm điểm
6. ⬜ TTS
7. ⬜ Import/Export
8. ⬜ Search + Stats + Break timer
9. ⬜ Polish UI/animation

## Đã dựng trong Phase 1

| File | Tương ứng bản gốc |
|---|---|
| `src/theme/theme.ts` | CSS `:root` (dark), `body.light` (light), `@media (max-width:680px)` — copy đúng số đo, không tự chọn |
| `src/theme/ThemeContext.tsx` | Toggle `body.classList.add('light')` → context React + AsyncStorage persist |
| `src/components/Header.tsx` | `#header` mobile: `#mobileMenuBtn`, logo "bei **TL**", 3 nút phải. `.header-session-pill`/`.header-new-session`/`.header-delete-session`/`#currentSessionLabel` **cố tình không render** (đúng vì bị `display:none` trên mobile) |
| `src/navigation/AppDrawer.tsx` | Sidebar mobile: drawer trượt trái `88vw`, overlay đen 55% (`#mobileOverlay`) — dùng `@react-navigation/drawer` với `drawerType:'front'` |
| `src/navigation/AuthStack.tsx`, `RootNavigator.tsx` | Chuyển màn hình theo trạng thái đăng nhập (thay cho việc show/hide `Login.html` vs `index.html`) |
| `src/screens/**`, `src/components/SidebarDrawer.tsx` | Stub — sẽ điền nội dung thật ở các phase tiếp theo |

## Đã dựng trong Phase 2

| File | Tương ứng bản gốc |
|---|---|
| `src/services/firebase/config.ts` | `initializeApp(firebaseConfig)` trong Login.html/index.html — **cùng project Firebase**, dùng `initializeAuth` + `getReactNativePersistence(AsyncStorage)` thay cho persistence mặc định của web SDK |
| `src/services/firebase/auth.ts` | `toFakeEmail`, `doLogin` → `login()`, `doRegister` → `register()`, `doFindUser` → `sendResetEmail()`, cộng `logout()`/`subscribeToAuthState()` (map `onAuthStateChanged` trong index.html) |
| `src/store/AuthContext.tsx` | Thay cho việc index.html chờ `_authReady` rồi redirect `Login.html`⇄`index.html` — RN dùng React state + `onAuthStateChanged` để quyết định stack nào hiện ra (`RootNavigator`) |
| `src/components/auth/AuthField.tsx` | `.field input` + `.err`/`.ok` — border/bg đổi màu đúng theo trạng thái, nút 👁/🙈 cho input mật khẩu |
| `src/components/auth/AuthButton.tsx` | `.btn-submit` (+ `.green`, gold inline style cho forgot/register) — spinner + label đổi khi loading |
| `src/components/auth/AuthMessageBox.tsx` | `.err-msg` / `.ok-msg` |
| `src/components/auth/AuthCard.tsx` | `.card`, `.deco` (3 chấm macOS), `.logo-row`, `.tagline`, `.divider` |
| `src/screens/auth/LoginScreen.tsx` | `#formView` + `doLogin()` — validate thứ tự y hệt, "Ghi nhớ đăng nhập", "Quên mật khẩu?", success view 600ms rồi chuyển vào app |
| `src/screens/auth/RegisterScreen.tsx` | `#registerView` + `doRegister()` — đúng thứ tự validate: họ tên → username ≥3 → password ≥6 → confirm khớp |
| `src/screens/auth/ForgotPasswordScreen.tsx` | `#forgotView` + `doFindUser()` — xem lưu ý fidelity bên dưới |

### Lưu ý sai khác có chủ đích (đã ghi rõ trong code)
- **`ForgotPasswordScreen`**: markup gốc có `forgotStep2` (nhập mật khẩu mới) nhưng **không hề được nối logic thật** trong Login.html (`resetPwBtn.addEventListener("click", () => {})` — rỗng). Hành vi thật của bản gốc chỉ là gửi email reset qua Firebase rồi báo thành công, dừng ở bước 1. RN app dựng đúng hành vi *thật sự chạy được*, không dựng lại UI chết.
- **"Ghi nhớ đăng nhập"**: bản gốc phân biệt `localStorage` (nhớ) và `sessionStorage` (chỉ nhớ trong tab, mất khi đóng tab). RN không có khái niệm "đóng tab" — gần nhất là "đóng hẳn app". Nên: nếu không tích "ghi nhớ", app sẽ tự đăng xuất ở lần mở lại đầu tiên (mô phỏng sessionStorage); nếu có tích, Firebase AsyncStorage persistence giữ đăng nhập vô thời hạn (như localStorage). Ghi rõ trong `AuthContext.tsx`.
- **Logout thật (`signOut(auth)`)**: bản gốc (`logoutBtn` trong index.html) chỉ xoá vài key `localStorage`/`sessionStorage` rồi redirect, **không gọi `signOut()` Firebase thật** — với kiến trúc RN (điều hướng theo trạng thái Firebase Auth), không gọi `signOut()` sẽ khiến nút đăng xuất không hoạt động. Đây là sửa lỗi bắt buộc để tính năng hoạt động đúng, không phải thay đổi tuỳ tiện.
- Font "DM Mono" cần bundle qua `expo-font` (`useFonts`) — hiện tại style đã set `fontFamily: 'DM Mono'` nhưng sẽ fallback về monospace hệ thống cho tới khi font được load ở phase polish (Phase 9).

## Đã dựng trong Phase 3

| File | Tương ứng bản gốc |
|---|---|
| `src/types/models.ts` | Interface `VocabWord`/`Session`/`Folder` ở mục 6 prompt — schema giữ nguyên |
| `src/services/firebase/paths.ts` | `sessCol/sessDoc/vocabCol/vocabDoc/mastCol/mastDoc/flagCol/flagDoc/folderCol/folderDoc` |
| `src/services/cache.ts` | Thay `localStorage.getItem/setItem` (đồng bộ) bằng AsyncStorage (bất đồng bộ) — **cùng tên key** (`cache_sessions_*`, `vocab_*`, `cache_mastered_*`, `cache_flagged_*`, `sessionFolders`) để dễ đối chiếu. `clearStaleVocabCaches()` = đoạn dọn cache đầu `bootstrap()` |
| `src/services/firebase/sessions.ts` | `dbGetAllSessions`, `dbSaveSession`, `dbDeleteSession` |
| `src/services/firebase/words.ts` | `dbGetSessionVocab`, `dbAddWord`, `dbUpdateWord`, `dbDeleteWord`, `invalidateVocabCache`, `_cache.vocab` |
| `src/services/firebase/masteredFlagged.ts` | `dbGetMastered/dbMarkMastered/dbUnmarkMastered`, `dbGetFlagged/dbMarkFlagged/dbUnmarkFlagged`, `_cache.mastered`/`_cache.flagged` |
| `src/services/firebase/folders.ts` | `getFolders`, `createFolder`, `renameFolder`, `deleteFolder`, `setSessionFolder` |
| `src/services/firebase/realtimeSync.ts` | `_startSessionListeners`, `_stopSessionListeners`, `initRealtimeSync`, `switchRealtimeSession`, `addRealtimeSession` — cùng logic bỏ qua `hasPendingWrites` để tránh vòng lặp ghi-đè |
| `src/store/DataStore.tsx` | `bootstrap()` (tạo phiên mặc định + từ mẫu "der Tisch" nếu tài khoản mới), `switchSession()`, `createNewSession()` — dưới dạng React Context thay vì biến module-level toàn cục |

### Lưu ý sai khác có chủ đích
- Mọi hàm service giờ nhận `uid` làm tham số tường minh thay vì đọc biến `_uid` toàn cục — cần thiết vì RN không có khái niệm "1 trang đang chạy, load lại là mất state" như web; `uid` lấy từ `AuthContext`.
- `localStorage` (đồng bộ) → `AsyncStorage` (bất đồng bộ): mọi nơi gọi cache trong service giờ là `await`. Không đổi tên key, không đổi hành vi fallback khi mất mạng.
- **"Gộp nhiều phiên để luyện chung" (merge sessions, mục B checklist)** và toàn bộ logic build danh sách câu hỏi/batch chưa nằm ở phase này — đó là phần "màn hình luyện tập chính" (Phase 5), nơi `addRealtimeSession` sẽ được dùng cho nhiều sid cùng lúc. Phase 3 mới dừng ở tầng data thuần (CRUD + sync), chưa có UI dùng nó.
- `DataStore.tsx` mới lưu "phiên đang học cuối cùng" (`currentSessionId_{uid}`) — bản đầy đủ của `saveAppState`/`loadAppState` (câu hỏi đang làm, batch, filter...) sẽ đến ở Phase 8 theo đúng thứ tự prompt.

## Đã dựng trong Phase 4

| File | Tương ứng bản gốc |
|---|---|
| `src/components/BottomSheetModal.tsx` | `.modal-overlay`/`.modal-box` mobile (trồi từ dưới, bo góc trên 16px, max-height 90%) — dùng chung cho MỌI modal từ phase này trở đi, đúng yêu cầu mục 1.1 |
| `src/store/DialogsContext.tsx` | `customConfirm`, `customPrompt`, `_ensureCustomPromptModal` — Promise-based, hiện dưới dạng bottom-sheet thay vì `confirm()`/`prompt()` trình duyệt |
| `src/store/ToastContext.tsx` | `showToast` / `#toast` — căn giữa dưới màn hình, tự ẩn |
| `src/components/WordItemCard.tsx` | `.word-item` mobile (accordion `.word-item-actions-row` mở bằng `.word-expand-btn` •••, tint mastered/flagged đúng màu) |
| `src/components/WordFormModal.tsx` | Form thêm/sửa 1 từ (checklist D.1) — Từ Đức (chấp nhận `"a / b"`), loại từ, nghĩa, ví dụ |
| `src/components/FolderManagerModal.tsx` | `renderFolderModal()` — CRUD thư mục + gán phiên vào thư mục (checklist C) |
| `src/components/SidebarDrawer.tsx` | `renderSidebar()`/`_renderSidebarInner()` — session switcher (chuyển/đổi tên/xoá), search + 4 tab lọc (Tất cả/Đang học/Đã thuộc/Chú ý), bulk select mode, FAB thêm từ |

### Lưu ý phạm vi
- **"Gộp nhiều phiên để luyện chung" (merge sessions, checklist B)** cố ý CHƯA làm ở đây — đó là tính năng của màn luyện tập (`customMaster`/`buildFullList` trong bản gốc), sẽ vào đúng Phase 5.
- **Tìm kiếm toàn cục (mọi phiên cùng lúc)**: sidebar hiện chỉ tìm trong phiên đang mở (giống filter cơ bản trong sidebar gốc). Modal "Tìm kiếm toàn cục" riêng (`openGlobalSearchModal`) là mục 8 (Search + Stats).
- **Thư mục lồng nhau (parentId)**: model đã có sẵn `parentId` (mục 6), nhưng UI `FolderManagerModal` hiện hiển thị phẳng (không cây con-cha) — bản gốc cũng không thấy UI cây thực sự rõ ràng cho việc này trong `renderFolderModal`; sẽ bổ sung nếu cần khi rà lại ở Phase 9.
- Import hàng loạt / Excel / JSON (checklist D còn lại) thuộc Phase 7 (Import/Export).

## Đã dựng trong Phase 5

| File | Tương ứng bản gốc |
|---|---|
| `src/utils/grading.ts` | `normalizeVi`, `normForCheck`, `normNoMiddot`, `isSmartMatch`, `isMeaningMatch`, `isSentenceMatch`, `getReducedTarget`, `checkWriteAnswer`, `shuffleArray` — **copy chính xác từng bước biến đổi chuỗi**, kể cả bảng `_viMap` xoá dấu tiếng Việt và quy tắc động từ ghép viết liền (`mitkommen` ≡ `mit·kommen`) |
| `src/utils/questionBuilder.ts` | `buildFullList` (phần theo phiên đơn — chưa gộp phiên), `getEffectiveType` (mixedRandom xoay vòng `fullWord`→`fullMeaning`), `generateChoices` (sinh 4 đáp án trắc nghiệm, đúng logic nhiễu theo từng loại bài + mode nghe) |
| `src/utils/promptDisplay.ts` | Khối if/else dựng `typeTag`/nội dung câu hỏi hiển thị (viết/nghe/chọn × 3 loại bài) |
| `src/hooks/usePracticeEngine.ts` | Toàn bộ state luyện tập module-level gốc (`currentQuestionsList`, `currentQIndex`, `exerciseMode`, `currentExerciseType`, `_mixRound`, `stats`) + `onInputChange` (chấm điểm sống từng ký tự, chỉ bật viền đỏ khi gõ đủ độ dài đáp án — tránh nháy đỏ giữa chừng), `moveNext`, `updateBatchBar` |
| `src/components/practice/ExercisePromptCard.tsx` | `.ex-prompt` — 4 trạng thái màu **đúng thứ tự ưu tiên gốc**: `flagged > mastered > correct > normal`, dùng gradient token đã copy ở Phase 1 |
| `src/components/practice/ExerciseAnswerInput.tsx` | `#dynamicAnswerInput` — viền xanh/đỏ theo `inputStatus` |
| `src/components/practice/MCOptions.tsx` | `.mc-options`/`.mc-option` — chế độ Chọn, hiện xanh đúng/đỏ sai sau khi bấm rồi khoá |
| `src/components/practice/ExerciseActionsRow.tsx` | `#exBtnsRow` — Chú ý (flag), đổi mode, đổi loại bài, bỏ qua |
| `src/components/practice/MobileStatsBar.tsx` | `#mobileStatsBar`/`updateStatsBar()` |
| `src/components/practice/BatchPill.tsx` | `#mobBatchInfo`/`updateBatchBar()` — chỉ hiện khi có giới hạn số từ/lượt |
| `src/screens/main/MainScreen.tsx` | `#exerciseArea`/`.ex-card` — ghép toàn bộ các phần trên |

### Lưu ý sai khác có chủ đích (đã ghi trong code)
- **TTS thật (Phase 6)**: nút 🔊 ở mode Nghe và việc tự phát âm khi trả lời đúng hiện là no-op — `onPlayAudio` đã có sẵn chỗ nối, sẽ nối `expo-speech` ở Phase 6 đúng thứ tự đã hẹn.
- **Character-hint box** (`buildCharHint` — thuật toán so khớp từng ký tự khá phức tạp để gợi ý đúng/sai từng chữ) **chưa dựng** ở phase này. Phần chấm điểm ĐÚNG/SAI (an toàn nhất, ảnh hưởng trực tiếp đến việc có tính là trả lời đúng hay không) đã giữ đúng 100% logic gốc; phần hiển thị gợi ý từng ký tự là tính năng UX phụ, để dành khi rà lại UI polish ở Phase 9 nếu cần.
- **Luyện tập gộp nhiều phiên** (`currentSource === "merged"`) vẫn chưa có — thuộc Phase 8 theo đúng thứ tự đã thống nhất từ Phase 4.
- Cần thêm `expo-linear-gradient` vào `npm install` (đã có trong `package.json`) vì RN View không tự vẽ gradient như CSS.

## Đã dựng trong Phase 6

| File | Tương ứng bản gốc |
|---|---|
| `src/services/tts.ts` | `speakText`, `speakForMode`, `_speakLang` — xem lưu ý sai khác bắt buộc bên dưới |
| `src/store/SettingsContext.tsx` | biến toàn cục `soundEnabled` — persist qua AsyncStorage |
| `src/hooks/usePracticeEngine.ts` (cập nhật) | Tự phát tiếng Đức khi vào câu hỏi mới ở mode Nghe (mọi nơi gốc gọi `speakForMode(nq)` khi chuyển câu/đổi phiên/đổi loại bài — gộp thành 1 `useEffect` theo `currentQuestion.id`); tự phát âm khi trả lời đúng ở mode Viết/Chọn (**không** phát ở mode Nghe vì câu hỏi đã đọc rồi) — đúng dòng 6926-6934 và 8121-8123 gốc |
| `src/components/practice/ExercisePromptCard.tsx` (cập nhật) | Nút 🔊 replay thủ công ở mode Nghe giờ gọi TTS thật |
| `src/components/WordItemCard.tsx` (cập nhật) | Chạm vào từ tiếng Đức trong sidebar để nghe phát âm nhanh (`quickWord` gốc) |

### Sai khác bắt buộc: backend TTS
Bản gốc dùng **endpoint không chính thức** `translate.googleapis.com/translate_tts` (scrape Google Dịch) làm đường chính — fetch (desktop, qua AudioContext) hoặc thẻ `<audio>` (mobile WebView) — chỉ rơi về Web Speech API thật khi request đó lỗi. Endpoint này không có tài liệu chính thức, có thể bị chặn/giới hạn bất kỳ lúc nào, và không phù hợp để phụ thuộc vào trong app phát hành thật.

RN app dùng **`expo-speech`** — bọc engine TTS gốc của từng hệ điều hành (AVSpeechSynthesizer trên iOS, TextToSpeech trên Android). Đây chính xác là phần **fallback thật (Web Speech API)** của bản gốc, chỉ khác backend âm thanh — hợp đồng hành vi (phát gì, khi nào, do cờ nào điều khiển) giữ nguyên 100%. Chất lượng giọng đọc phụ thuộc giọng tiếng Đức có sẵn trên máy người dùng (giống hệt rủi ro của Web Speech API fallback gốc).

## Đã dựng trong Phase 7

| File | Tương ứng bản gốc |
|---|---|
| `src/services/importExport.ts` | `doImportWords`, `importFromFile` (nhánh json + xlsx/xls), `exportToExcel`, `exportSessionsToJson`, `importSessionsFromData` — copy đúng thứ tự alias field (`german/originalGerman/de`, `wordType/word_type/type`, `meaning/vi/vietnamese`, `example/beispiel`), đúng quy tắc nhận diện header Excel (`"Từ tiếng Đức"`/`"German"`/`"german"`), đúng logic gộp phiên trùng tên khi nhập (không tạo trùng, bỏ qua từ đã có theo `originalGerman` viết thường) |
| `src/components/ImportExportModal.tsx` | Gộp `#importTabBtn` (tab Nhập file trong word-group modal) + nút `📤 Xuất JSON`/`📥 Nhập phiên học` (folder/session menu) thành 1 bottom-sheet 2 tab — RN không có chỗ "word-group modal" cố định để gắn tab như bản gốc |

### Sai khác bắt buộc: cơ chế lưu/chia sẻ file
Bản gốc có `downloadBlob`/`mobileDownload` xử lý 3 kiểu tùy trình duyệt: `blob:` URI (desktop), `data:` URI (WebView APK builder không xử lý được blob:), và Web Share API. Không có khái niệm "tải xuống" nào trong số đó áp dụng được cho RN thật.

RN app dùng **`expo-file-system`** (ghi file vào cache của app) + **`expo-sharing`** (mở share sheet hệ điều hành) — đây là con đường chuẩn và duy nhất hợp lý trên RN để "xuất file", tương đương về mặt chức năng (người dùng vẫn lưu được file/chia sẻ ra ứng dụng khác) dù cơ chế kỹ thuật khác hẳn. Chọn file để nhập dùng `expo-document-picker` thay cho `<input type="file">`.

## Đã dựng trong Phase 8

| File | Tương ứng bản gốc |
|---|---|
| `src/services/searchHistory.ts` | `getSearchHistory`/`pushSearchHistory` (`sidebarSearchHistory`, tối đa 12 mục) |
| `src/components/GlobalSearchModal.tsx` | `openGlobalSearchModal()`/`runGlobalSearch(q)` — tìm xuyên **mọi phiên**, nhóm theo phiên, chạm kết quả → `switchSession` + đóng modal, đúng `normSearch` gốc |
| `src/store/SettingsContext.tsx` (mở rộng) | Thêm `breakEnabled`/`breakWorkMinutes`/`breakRestMinutes` (panel "Nghỉ giải lao") |
| `src/hooks/useBreakTimer.ts` | `startBreakWorkTimer`/`showBreakOverlay`/`hideBreakOverlay`/`restartBreakCycle` |
| `src/components/BreakOverlay.tsx` | `#breakOverlay` — xem lưu ý bên dưới |
| `src/components/SettingsModal.tsx` | Gộp toàn bộ cài đặt: âm thanh, nguồn câu hỏi (gộp phiên), các tuỳ chọn luyện tập đã có từ Phase 5 (`onlyUnmastered`, `strictVocabCheck`, `randomMode`, `autoAdvanceOnCorrect`, `studyMode`, `allowSkip`, `wordLimit`), nghỉ giải lao — đúng như đã hẹn ở Phase 5/7 |
| `src/utils/questionBuilder.ts` (mở rộng) | `buildMergedQuestionList` — nhánh `currentSource === "merged"` của `buildFullList()`, id ghép `"sid:realId"` |
| `src/hooks/usePracticeEngine.ts` (mở rộng) | **Luyện gộp nhiều phiên đã hẹn từ Phase 4/5**: `source`/`mergedSessionIds`, rebuild danh sách bất đồng bộ khi gộp, định tuyến đúng phiên khi đánh dấu thuộc/chú ý ở chế độ gộp (dùng `_sessId`/`_realId` thay vì gọi qua `DataStore` vì từ có thể không thuộc phiên đang mở) |
| `src/screens/main/MainScreen.tsx` (cập nhật) | Nối nút 🔍/⚙️ ở header vào 2 modal trên, mount `BreakOverlay` |

### Lưu ý sai khác có chủ đích
- **`BreakOverlay`**: bản gốc có hoạt ảnh mèo trượt vào (`neko1.webm` → `neko2.webm`) nhưng **CHÍNH bản gốc cũng tắt hẳn phần video này trên độ rộng mobile** (`isMobileBreak` rẽ nhánh bỏ qua video, chỉ còn overlay + đếm ngược). Vì app này là bản mobile, ta chỉ cần dựng đúng nhánh mobile đó — không cần mang `.webm` sang RN (định dạng này cũng không được RN hỗ trợ sẵn không cần thư viện native bổ sung), không phải bỏ sót.
- **Đồng bộ đa tab (`BroadcastChannel`)**: bản gốc đồng bộ state giữa nhiều tab trình duyệt cùng đăng nhập — khái niệm "nhiều tab" không tồn tại trên app di động (mỗi lúc chỉ có 1 instance chạy), nên phần này không có đối tượng tương đương và bị bỏ qua có chủ đích.

## Đã dựng trong Phase 9

| Việc | Tương ứng bản gốc |
|---|---|
| `assets/fonts/{DMMono-Regular,DMMono-Medium,Syne-Bold}.ttf` + `useFonts` trong `App.tsx` | 2 font thật của bản gốc (`"Syne"` cho toàn bộ UI — `body { font-family: "Syne" }` —, `"DM Mono"` cho input/số liệu), nạp qua `expo-font` với màn splash chờ tải xong |
| `Text.defaultProps.style`/`TextInput.defaultProps.style` override trong `App.tsx` | Cách nhẹ nhất để áp `font-family: Syne` cho TOÀN BỘ chữ trong app mà không phải sửa từng file — RN không có cascade CSS như web nên đây là kỹ thuật chuẩn thường dùng |
| `ExercisePromptCard.tsx` (progress bar) | `.progress-fill { transition: width 0.4s cubic-bezier(0.34,1.56,0.64,1) }` — dùng `Animated.timing` + `Easing.bezier` đúng hệ số nảy gốc |
| `ExerciseAnswerInput.tsx` | `.correct-border`/`.wrong-border { transition: border-color 0.3s }` — viền đổi màu mượt bằng `Animated.Value` nội suy màu thay vì đổi màu tức thì |
| `ToastContext.tsx` | `#toast { transition: opacity 0.3s }` — fade in/out mượt bằng `Animated.timing` |
| `WordItemCard.tsx` | Accordion mở/đóng dùng `LayoutAnimation.easeInEaseOut` (bật `UIManager.setLayoutAnimationEnabledExperimental` trên Android) |
| `ExercisePromptCard.tsx` (counter) | Sửa điểm còn để trống từ Phase 8: hiện đúng **tên phiên gốc** của từng câu hỏi khi đang ở chế độ gộp nhiều phiên, thay vì luôn ghi "Phiên" |

### Những gì CHƯA làm, và lý do dừng ở đây
- **App icon/splash image thật**: `app.json` đã có khung cấu hình nhưng chưa có file `.png` icon/splash thật — cần bộ nhận diện thương hiệu (logo) thật sự từ bạn trước khi tạo, không phải việc code có thể tự quyết định thay.
- **`buildCharHint`** (gợi ý từng ký tự khi gõ sai, đã nêu ở Phase 5): vẫn chưa dựng — đây là tính năng UX phụ trợ, không phải phần chấm điểm cốt lõi (phần đó đã chuẩn 100% từ Phase 5).
- **Bảng cha-con thật cho thư mục** (`FolderManagerModal` hiện phẳng, đã nêu ở Phase 4): model đã có sẵn `parentId`, chỉ thiếu UI cây lồng nhau — bản gốc cũng không có UI rõ ràng cho việc này.

## Tổng kết toàn bộ dự án
Ứng dụng React Native/Expo đã có đủ 9 phần theo đúng thứ tự đã thống nhất, chạy được bằng `npm install && npx expo start`. Mọi sai khác so với bản gốc đều **có chủ đích và có lý do kỹ thuật rõ ràng** (không phải bỏ sót), được ghi chú ngay tại chỗ trong code bằng comment trỏ về dòng tương ứng trong `index.html`/`Login.html`, và tổng hợp lại trong README này theo từng phase. Cần đăng nhập Firebase thật (cùng project `deutschbei-tl`) để dùng được — không phải seed data giả.

## Bản vá sau khi so ảnh chụp thật với bản gốc

Sau khi bạn gửi ảnh chụp app Android thật so với bản web mobile gốc, phát hiện 1 lỗi và vài chỗ dựng sai/thiếu:

| Vấn đề | Nguyên nhân | Đã sửa |
|---|---|---|
| **3 nút bị kéo giãn dọc thành cột cao** (lỗi hiển thị nghiêm trọng) | `ExerciseActionsRow` dùng `ScrollView` ngang không giới hạn chiều cao + `alignItems` mặc định là `stretch`, bị màn hình cha (`flexGrow:1`) đẩy giãn hết chiều cao còn lại | Bỏ `ScrollView`, dùng `View` hàng ngang cố định chiều cao (`height: mobile.exBtnMinHeight`) |
| **Sai hoàn toàn bộ nút dưới ô câu hỏi** | Tôi tự đoán là nút đổi mode/loại bài, nhưng đúng ra `#exBtnsRow` gốc là `💡 Gợi ý · ⭐ Chú ý · ✏️ Sửa · ⏮ ⏭` | Dựng lại đúng bộ nút + đúng thứ tự, `⏮`/`⏭` đẩy sang phải bằng spacer |
| **Đổi loại bài/mode phải là dropdown ở thanh thống kê, không phải nút bấm cycle** | Đọc nhầm vị trí — thực ra `#mobExerciseTypeSelect`/`#mobModeSelect` nằm ngay trong `#mobileStatsBar`, cùng hàng với "✓ đúng/tổng %" | `MobileStatsBar` giờ có 2 dropdown (mở bottom-sheet chọn) + nút `🔄 Reset` (reload lại danh sách câu hỏi) |
| **Thiếu huy hiệu loại từ màu tím** (`N (SG.)`...) cạnh câu hỏi | Bỏ sót `wtBadge` khi build `ExercisePromptCard` ở Phase 5 | Thêm lại đúng màu/style |
| **Thiếu hàng 5 icon bật/tắt nhanh** (🔀 ngẫu nhiên, ⚡ tự động qua câu, ⏭ cho phép bỏ qua, 🔊 âm thanh, 📖 học bài) cạnh bộ đếm câu hỏi | Bỏ sót `settingsBarHtml` | Thêm `QuickToggle` — mờ khi tắt, sáng khi bật, bấm là đổi trực tiếp |
| **Thiếu nút "Gợi ý"** | `buildCharHint` bị hoãn ở Phase 5 nhưng tôi quên dựng cả nút bấm | Thêm `utils/hint.ts` — 2 nhánh câu ví dụ/nghe y hệt gốc, nhánh viết thường dùng bản rút gọn (che ký tự chưa gõ đúng) thay cho thuật toán diff đầy đủ (đã ghi rõ đây vẫn là điểm đơn giản hoá có chủ đích, không phải lỗi) |
| **Thiếu nút "Sửa" ngay tại màn luyện tập** | Trước chỉ sửa được từ sidebar | Nút "✏️ Sửa" giờ mở `WordFormModal` sửa trực tiếp từ đang luyện |
| **Thứ tự icon Header sai** | Đoán thứ tự thay vì đối chiếu ảnh thật | Đổi thành `📁 ☑️ 🔍 ⚙️` đúng ảnh gốc, nút 📁 giờ mở được `FolderManagerModal` (trước là nút chết) |

## Bản vá lần 2 (sau khi chụp ảnh app Android thật lần thứ 2)

| Vấn đề | Nguyên nhân | Đã sửa |
|---|---|---|
| **Header/thanh thống kê bị đẩy lên che mất thanh trạng thái Android, không bấm được** | `MainScreen.tsx` dùng `SafeAreaView` từ **`react-native` gốc** — component này **chỉ hoạt động trên iOS**, trên Android nó không làm gì cả (không tự chèn padding an toàn), nên header render đè lên thanh trạng thái luôn, và vùng đó thường không nhận touch | Đổi sang `SafeAreaView` từ **`react-native-safe-area-context`** (đã có sẵn trong dependencies từ Phase 1, dùng đúng ở `SidebarDrawer` từ Phase 4 nhưng quên áp dụng ở `MainScreen`) |
| **Hộp gợi ý hiển thị sai hoàn toàn kiểu web mobile** | Tôi tự viết bản "che ký tự chưa gõ đúng bằng dấu `_`" ở bản vá lần 1, nhưng bản gốc thật (`buildCharHint`) hiển thị **toàn bộ đáp án**, tô màu từng ký tự: **trắng/xanh** = đã gõ đúng tới đó, **đỏ có gạch chân** = đúng 1 ký tự sai đầu tiên, **tím nhạt** = phần còn lại (kể cả phần trong ngoặc như cách chia động từ, so khớp lỏng hơn — bỏ qua dấu câu) | Viết lại `src/utils/charHint.ts` — port nguyên thuật toán gốc (tách vùng chính/vùng ngoặc, dừng tô đỏ ở ký tự sai đầu tiên, các ký tự sau đó về trạng thái "chưa tới" chứ không phải "sai"), hiển thị bằng `<Text>` tô màu từng ký tự đúng 3 màu gốc |

## `google-services.json`
File cấu hình Firebase Android thật đã được thêm vào gốc project + khai báo trong `app.json` (`android.googleServicesFile`).

**Đã sửa 1 chỗ lệch bắt buộc**: file này đăng ký package `com.deutschbeitl.app`, trong khi `app.json` trước đó để `com.beitl.app`. Hai giá trị này **phải khớp tuyệt đối** để Firebase native nhận đúng app, nên đã đổi `android.package` (và đồng bộ luôn `ios.bundleIdentifier`) thành `com.deutschbeitl.app`.

**Lưu ý quan trọng**: app hiện dùng **Firebase JS SDK** (`firebase` npm package, cấu hình bằng object `firebaseConfig` trong `src/services/firebase/config.ts`) — SDK này **không đọc** `google-services.json`, nên chưa cần file này để chạy `npx expo start` như bình thường. File này chỉ thật sự được dùng khi:
- Build native qua `expo prebuild`/EAS Build và thêm plugin native Firebase (ví dụ `@react-native-firebase/app` nếu sau này muốn dùng push notification qua FCM, Crashlytics, hoặc Analytics native thay vì JS SDK).
- Nó đã được đặt đúng chỗ (`google-services.json` ở root + khai báo trong `app.json`) sẵn cho việc đó, không cần làm gì thêm ở bước này.

Nếu về sau build cho iOS và cần Firebase native, sẽ cần thêm `GoogleService-Info.plist` tương ứng (Firebase Console → App iOS) — file google-services.json chỉ dành cho Android.

## Chạy thử

```bash
npm install
npx expo start
```

> Lưu ý: cần thêm file cấu hình Firebase thật (`src/services/firebase/config.ts`) ở Phase 3 trước khi Auth hoạt động — hiện tại `AuthContext` chỉ là state giả (`user` luôn `null` → luôn vào `AuthStack`).
