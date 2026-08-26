# Ghi nhận nguồn dữ liệu

Phần mã nguồn của dự án là của dự án. Phần **dữ liệu** thì không: gần như toàn bộ
từ vựng, tần suất từ và trình độ CEFR đều lấy từ các bộ dữ liệu bên ngoài, mỗi bộ
mang giấy phép riêng. File này liệt kê từng bộ, nguồn gốc và giấy phép của nó.

Metadata gốc nằm trong `public/data/decks/index.json` và trong các script sinh dữ
liệu ở `scripts/`; bảng dưới đây chỉ gom lại cho dễ đọc.

## Bộ từ vựng — `public/data/decks/`

| Bộ | File | Số từ | Nguồn | Giấy phép |
|---|---|---|---|---|
| 4000 Essential English Words | `essential-4000.json` | 3.600 | [RealKai42/qwerty-learner](https://github.com/RealKai42/qwerty-learner), gốc từ Compass Publishing | **GPL-3.0** |
| Oxford 5000 | `oxford-5000.json` | 5.836 | [RealKai42/qwerty-learner](https://github.com/RealKai42/qwerty-learner), gốc từ Oxford University Press | **GPL-3.0** |
| TOEIC 600 Essential Words | `toeic-600.json` | 584 | [tranngocminhhieu/toeic-600-words-dataset](https://github.com/tranngocminhhieu) (tflat.vn) | **Không ghi giấy phép** |
| Daily Conversations | dẫn xuất từ `toeic-600.json` | 94 | như trên, lọc theo chủ đề đời sống | **Không ghi giấy phép** |

Tổng: **10.114 từ**, trong đó **9.436 từ mang GPL-3.0** và **678 từ không rõ giấy phép**.

## Dữ liệu khác

| Dữ liệu | File | Quy mô | Nguồn | Giấy phép |
|---|---|---|---|---|
| Trục CEFR + tần suất từ | `public/data/words.json` | 4.298 mục | CEFR-J Wordlist ghép với wordfreq-en-25000 (xem `scripts/build-cefr-spine.ts`) | **Chưa xác minh** — xem ghi chú dưới |
| Thư viện bài đọc | `public/data/reading.json` | 30 bài | Soạn trong `scripts/build-reading-library.ts` | Của dự án |
| Dữ liệu thô để dựng | `scripts/data/*.json` | — | Nguồn tương ứng ở trên | Theo nguồn |

**Ghi chú về trục CEFR.** `scripts/build-cefr-spine.ts` ghép hai bộ: hồ sơ từ vựng
CEFR-J (A1–B2 và C1–C2) và một bảng tần suất `wordfreq.json`. Điều kiện sử dụng của
hai bộ này **chưa được kiểm chứng** trong quá trình dựng dự án — chúng chỉ được tải
về và dùng. Trước khi phát hành cần tra lại giấy phép thật của cả hai và cập nhật
bảng này.

## Điều cần quyết định trước khi phát hành

GPL-3.0 là giấy phép **copyleft mạnh**. Đóng gói dữ liệu GPL-3.0 vào một sản phẩm
phát hành công khai kéo theo nghĩa vụ pháp lý thật — thông thường là phải phát hành
toàn bộ tác phẩm phái sinh cũng dưới GPL-3.0, kèm mã nguồn. Ở đây phần dữ liệu GPL
chiếm 9.436 trong 10.114 từ, tức phần lớn nội dung của app.

Repo hiện **không có** file `LICENSE` nào ở gốc, nghĩa là mã nguồn đang ở trạng thái
"mọi quyền được bảo lưu" theo mặc định của luật bản quyền — trạng thái này mâu thuẫn
với việc phân phối dữ liệu GPL kèm theo.

Đây là quyết định của chủ dự án, không phải việc có thể tự chọn thay. Ba hướng khả dĩ:

1. **Phát hành cả dự án dưới GPL-3.0.** Đơn giản nhất về pháp lý, nhưng ràng buộc mọi
   người dùng lại sau này.
2. **Thay hai bộ GPL** bằng dữ liệu có giấy phép dễ chịu hơn (CC BY, MIT, hoặc tự
   dựng). Giữ được quyền chọn giấy phép cho mã nguồn, nhưng mất 9.436 từ và phải tìm
   nguồn thay thế.
3. **Tách dữ liệu ra khỏi repo**, tải về lúc build hoặc lúc chạy. Cách này giảm rủi ro
   phân phối nhưng không xoá được nó — cần tư vấn pháp lý nếu app là sản phẩm thương mại.

Bộ 678 từ không rõ giấy phép cũng cần xử lý: "không ghi giấy phép" nghĩa là **không có
quyền sử dụng**, chứ không phải "tự do dùng".
