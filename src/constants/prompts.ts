/**
 * Prompt "Trích xuất từ vựng tiếng Đức từ hình ảnh" — người dùng copy prompt
 * này rồi dán cho một trợ lý AI có khả năng đọc ảnh/PDF (vd. ChatGPT,
 * Gemini...) kèm ảnh tài liệu học tiếng Đức của họ. Kết quả trả về đúng 4
 * cột TSV (Từ[TAB]Loại từ[TAB]Nghĩa[TAB]Câu ví dụ) khớp thẳng với định dạng
 * mà tab "Hàng loạt" trong modal "Thêm từ mới" đang parse (xem
 * utils/bulkWordParser.ts) — dán thẳng kết quả vào đó là xong, không cần
 * chỉnh sửa gì thêm.
 *
 * Bản thân app KHÔNG tự gọi API AI để đọc ảnh — đây chỉ là văn bản prompt
 * dùng ở nơi khác, nên chỉ cần lưu tĩnh + có nút "Sao chép" trong Cài đặt.
 * Nội dung giữ NGUYÊN VĂN theo đúng prompt người dùng cung cấp.
 */
export const IMAGE_VOCAB_EXTRACTION_PROMPT = `Bạn là trợ lý học tiếng Đức. Tôi sẽ gửi cho bạn một hoặc nhiều hình ảnh hoặc file PDF.

## NHIỆM VỤ
Đọc tài liệu theo đúng thứ tự xuất hiện (trái → phải, trên → dưới; PDF: từng trang theo thứ tự trang) và trích xuất các TỪ CHÍNH tiếng Đức.

## TỪ CHÍNH LÀ
- Danh từ, động từ, tính từ, trạng từ có nghĩa thực
- Giới từ có cách bắt buộc (mit, für, auf, an…) nếu được dạy rõ trong tài liệu

## KHÔNG LẤY
- Mạo từ đứng độc lập (der, die, das khi không kèm danh từ)
- Liên từ đơn giản (und, oder, aber, weil…) trừ khi là trọng tâm bài học
- Số đếm, ký hiệu, tên riêng, tên địa danh thông thường
- Từ lặp lại (chỉ lấy lần đầu xuất hiện)
- Từ trong câu ví dụ minh họa nếu đã có trong danh sách từ chính của bài

## BƯỚC XỬ LÝ BẮT BUỘC (thực hiện nội tâm trước khi xuất)
1. Đọc toàn bộ tài liệu theo thứ tự trang / vùng
2. Xác định đâu là từ chính (tiêu đề bài, bảng từ, in đậm, được giải nghĩa riêng)
3. Lọc bỏ các từ thuộc danh sách KHÔNG LẤY
4. Giữ đúng thứ tự xuất hiện, loại trùng
5. Chỉ sau khi hoàn thành 4 bước trên mới xuất kết quả

## ĐỊNH DẠNG ĐẦU RA — BẮT BUỘC TUYỆT ĐỐI

⚠️ Chỉ xuất các dòng dữ liệu TSV. KHÔNG viết thêm bất cứ thứ gì: không lời mở đầu, không tiêu đề cột, không giải thích, không đánh số, không markdown, không dấu backtick.

Mỗi dòng gồm đúng 4 cột, phân cách bằng TAB (\t), theo thứ tự bất biến:
[Từ tiếng Đức][TAB][Loại từ][TAB][Nghĩa tiếng Việt][TAB][Câu ví dụ (Bản dịch.)]

Ví dụ — xuất y hệt dạng này, không thêm không bớt:
der Apfel / die Äpfel	n	quả táo	Ich esse jeden Tag einen Apfel. (Tôi ăn một quả táo mỗi ngày.)
laufen (du läufst, er läuft, lief, ist gelaufen)	v	chạy	Er läuft jeden Morgen im Park. (Anh ấy chạy trong công viên mỗi buổi sáng.)
helfen (du hilfst, er hilft, half, hat geholfen) [+ D]	v	giúp đỡ	Ich helfe meiner Mutter. (Tôi giúp mẹ tôi.)
an·sehen (du siehst an, er sieht an, sah an, hat angesehen) [+ Akk]	v	nhìn, xem	Er sieht sie an. (Anh ấy nhìn cô ấy.)
kaufen (kaufte, hat gekauft)	v	mua	Sie kauft ein Buch. (Cô ấy mua một cuốn sách.)
machen (machte, hat gemacht)	v	làm	Er macht seine Hausaufgaben. (Anh ấy làm bài tập về nhà.)
auf·räumen (räumte auf, hat aufgeräumt)	v	dọn dẹp	Er räumt sein Zimmer auf. (Anh ấy dọn dẹp phòng.)
kaputt	adj	hỏng, bị vỡ	Das Gerät ist kaputt. (Thiết bị bị hỏng.)

## QUY TẮC CHI TIẾT TỪNG LOẠI TỪ

**Danh từ (loại từ: n):**
- Danh từ thông thường: \`der/die/das [số ít] / die [số nhiều]\`
  - Ví dụ: \`der Tisch / die Tische\`, \`die Frau / die Frauen\`, \`das Kind / die Kinder\`
- Danh từ chỉ số ít (không có số nhiều): loại từ ghi \`n (Sg.)\`
  - Ví dụ: \`der Hunger\` → loại từ: \`n (Sg.)\`
- Danh từ chỉ số nhiều (không có số ít): loại từ ghi \`n (Pl.)\`, ghi từ dạng số nhiều
  - Ví dụ: \`die Leute\` → loại từ: \`n (Pl.)\`

**Động từ (loại từ: v) — Quy tắc ghi dạng chia:**
- **Động từ đều (KHÔNG biến âm du/er):** chỉ ghi \`[nguyên mẫu] (Präteritum, haben/sein + Partizip II)\` — KHÔNG cần ghi du/er vì không đặc biệt
  - Ví dụ: \`kaufen (kaufte, hat gekauft)\`
  - Ví dụ: \`machen (machte, hat gemacht)\`
  - Ví dụ: \`lernen (lernte, hat gelernt)\`
- **Động từ bất quy tắc (CÓ biến âm du/er):** ghi \`[nguyên mẫu] (du [chia du], er [chia er], Präteritum, haben/sein + Partizip II)\` — ghi du/er vì có biến âm đặc biệt
  - Ví dụ: \`fahren (du fährst, er fährt, fuhr, ist gefahren)\`
  - Ví dụ: \`lesen (du liest, er liest, las, hat gelesen)\`
  - Ví dụ: \`schlafen (du schläfst, er schläft, schlief, hat geschlafen)\`
- **Động từ tách (trennbar):** dùng dấu \`·\` để đánh dấu tiền tố tách
  - Nếu động từ gốc KHÔNG biến âm: \`[tiền·tố·nguyên·mẫu] (Präteritum, haben/sein + Partizip II)\`
    - Ví dụ: \`auf·räumen (räumte auf, hat aufgeräumt)\`
    - Ví dụ: \`auf·machen (machte auf, hat aufgemacht)\`
  - Nếu động từ gốc CÓ biến âm du/er: ghi thêm du/er
    - Ví dụ: \`an·rufen (du rufst an, er ruft an, rief an, hat angerufen)\`
    - Ví dụ: \`mit·kommen (du kommst mit, er kommt mit, kam mit, ist mitgekommen)\`
- **Động từ sein/haben/werden và Modalverben:** ghi đủ du/er + Präteritum + Perfekt
  - Ví dụ: \`sein (du bist, er ist, war, ist gewesen)\`
  - Ví dụ: \`haben (du hast, er hat, hatte, hat gehabt)\`
  - Ví dụ: \`können (du kannst, er kann, konnte, hat gekonnt)\`
- **Giới từ đi kèm động từ (nếu có):** ghi sau Partizip II — \`[+ D]\`, \`[+ Akk]\`, \`[+ auf + Akk]\`, \`[+ für + Akk]\`…
  - Ví dụ: \`helfen (du hilfst, er hilft, half, hat geholfen) [+ D]\`
  - Ví dụ: \`warten (wartete, hat gewartet) [+ auf + Akk]\`
  - Ví dụ: \`sich freuen (freute sich, hat sich gefreut) [+ über + Akk / + auf + Akk]\`
- ⚠️ TUYỆT ĐỐI KHÔNG ghi du/er cho động từ đều — chỉ ghi khi có biến âm thực sự

**Tính từ (loại từ: adj):** viết từ đơn giản

**Trạng từ (loại từ: adv):** viết từ đơn giản

**Giới từ (loại từ: prep):** ghi kèm cách — ví dụ: \`mit [+ D]\`, \`für [+ Akk]\`

**Loại khác (loại từ: other):** viết từ đơn giản

## QUY TẮC CHUNG
- Câu ví dụ: ngắn, tự nhiên, đúng ngữ pháp, thể hiện rõ cách dùng của từ — theo sau là bản dịch tiếng Việt trong dấu ngoặc đơn, ví dụ: \`Er schläft. (Anh ấy đang ngủ.)\`
- Nếu tài liệu có sẵn câu ví dụ cho từ đó → ưu tiên dùng câu đó. Nếu KHÔNG có → TỰ TẠO câu ví dụ ngắn, tự nhiên, đúng ngữ pháp, phù hợp nghĩa của từ
- KHÔNG để trống cột câu ví dụ — bắt buộc có ví dụ cho mọi từ
- TUYỆT ĐỐI không thêm văn bản ngoài dữ liệu, không thêm cột, không dùng markdown, không dùng JSON
- Nếu không chắc về một từ → vẫn đưa vào, đừng tự loại bỏ`;
