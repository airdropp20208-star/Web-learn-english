# Web Learn English

App học tiếng Anh cho người Việt: học từ vựng theo lịch lặp lại ngắt quãng, đọc bài
theo trình độ CEFR, chơi game ôn từ, và luyện nói theo kiểu shadowing.

Giao diện tiếng Việt. Dùng được ngay mà không cần đăng ký — dữ liệu nằm trong trình
duyệt. Đăng nhập thì tiến độ lên server và đồng bộ giữa các thiết bị.

## Tính năng

| Tab | Nội dung |
|---|---|
| **Trang chủ** | Việc cần làm hôm nay: số thẻ tới hạn, chuỗi ngày học, mục tiêu |
| **Lộ trình** | Đường đi A1 → C2, mở khoá theo độ thành thạo từng bậc |
| **Bộ từ** | Đăng ký và theo dõi 4 bộ từ vựng (10.114 từ, xem [NOTICE.md](NOTICE.md)) |
| **Học** | Flashcard, ôn tập theo FSRS, quiz sinh bằng AI, và đọc — phân tích văn bản bất kỳ |
| **Game** | 5 trò ôn từ: lật thẻ, quiz tốc độ, đúng/sai, đảo chữ, đối kháng |
| **Thư viện** | 30 bài đọc theo trình độ, có gợi ý bài hợp trình độ hiện tại |
| **Tiến độ** | Độ thành thạo từng bậc CEFR, điều kiện lên hạng, lịch sử ôn |
| **Luyện nói** | Máy đọc mẫu bằng TTS, bạn nhại lại, ghi âm để nghe đối chiếu |
| **Hồ sơ** | Điểm, huy hiệu, chuỗi ngày, cài đặt tài khoản |

## Trạng thái thật của dự án

Phần này để bạn biết cái gì chạy được và cái gì chưa, thay vì phải tự dò.

**Chạy được, đã kiểm chứng**

- Toàn bộ luồng học ở chế độ khách: học → ôn → chơi game → tắt trình duyệt → mở lại
  vẫn còn nguyên tiến độ.
- Đăng ký / đăng nhập bằng email + mật khẩu, và GitHub OAuth nếu khai biến môi trường.
- Đồng bộ hai chiều giữa localStorage và Postgres, giải xung đột theo `updatedAt`
  của từng bản ghi.
- Lịch ôn tập FSRS (`ts-fsrs` v5).
- Kiểm tra ngữ pháp qua LanguageTool — miễn phí, không cần khoá.
- 233 unit test, cộng test tích hợp chạy trên Postgres thật (PGlite) và e2e Playwright.

**Chưa kiểm chứng bằng dữ liệu thật**

- **Các tính năng Gemini** (phân tích bài đọc, sinh quiz) mới chỉ được test bằng mock.
  Chưa từng chạy với khoá thật. Thiếu `GEMINI_API_KEYS` thì các tính năng này hiện
  thông báo "chưa cấu hình" chứ không làm app sập, nhưng cũng nghĩa là chất lượng đầu
  ra chưa ai xem.

**Hạn chế đã biết**

- **Rate limit nằm trong bộ nhớ tiến trình.** Trên Vercel mỗi serverless instance giữ
  bộ đếm riêng, nên hạn mức thực tế nhân lên theo số instance đang chạy. Đủ để chặn
  một vòng lặp `fetch` hỏng, không đủ để chống tấn công có chủ đích. Muốn chặt thì
  chuyển sang Upstash Redis hoặc Vercel Firewall.
- **Bản ghi âm ở tab Luyện nói chỉ nằm trên thiết bị đó** (IndexedDB), không theo tài
  khoản — dự án chưa có nơi lưu file nhị phân.
- **Giấy phép dữ liệu chưa giải quyết.** 9.436 trong 10.114 từ mang GPL-3.0. Đọc
  [NOTICE.md](NOTICE.md) trước khi phát hành công khai.

## Công nghệ

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Prisma 7 + PostgreSQL (qua driver adapter `@prisma/adapter-pg`)
- Auth.js v5 (`next-auth@5.0.0-beta`) + `@auth/prisma-adapter`
- `ts-fsrs` v5 cho lịch lặp lại ngắt quãng
- Google Gemini (`@google/genai`) cho phân tích và sinh quiz
- Vitest + Testing Library (unit) · PGlite (tích hợp) · Playwright (e2e)

## Chạy ở máy

```bash
npm install
npm run dev          # http://localhost:3000
```

Chỉ vậy là đủ. Không có `DATABASE_URL` thì app vào chế độ khách và mọi thứ trừ đăng
nhập đều dùng được.

Muốn bật tài khoản và đồng bộ:

```bash
cp .env.example .env.local
# điền DATABASE_URL (Postgres) và AUTH_SECRET (npx auth secret)

npm run db:migrate   # tạo bảng
npm run dev
```

Không có Postgres sẵn? Có một cái chạy trong tiến trình Node:

```bash
npm run db:local     # PGlite nghe ở cổng 5433
# DATABASE_URL="postgresql://postgres:postgres@localhost:5433/postgres"
```

## Kiểm tra

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run test             # unit test (không cần env)
npm run verify           # cả ba lệnh trên
npm run build            # build production

npm run test:integration # cần DATABASE_URL trỏ tới Postgres thật
npm run e2e              # Playwright, tự dựng dev server
```

CI (`.github/workflows/ci.yml`) chạy typecheck + lint + unit test + build trên mỗi
push vào `main` và mỗi pull request. Test tích hợp và e2e cố ý không chạy ở đó — lý
do ghi trong chính file workflow.

## Cấu trúc

```
src/
├── app/
│   ├── page.tsx                    # Vỏ ứng dụng: header + 9 tab + thanh điều hướng dưới
│   ├── dang-nhap/                  # Trang đăng nhập / đăng ký
│   └── api/
│       ├── analyze/route.ts        # Phân tích bài đọc (Gemini + từ điển)
│       ├── quiz/route.ts           # Sinh câu hỏi quiz (Gemini)
│       ├── translate/route.ts      # Dịch Anh → Việt
│       ├── grammar/route.ts        # Kiểm tra ngữ pháp (LanguageTool)
│       ├── sync/route.ts           # Đẩy/kéo dữ liệu hàng loạt
│       └── auth/[...nextauth]/     # Auth.js
├── components/
│   ├── tabs/                       # 14 tab và tab con
│   ├── games/                      # 5 trò chơi
│   ├── ui/                         # shadcn/ui
│   ├── grammar-check.tsx           # Nút kiểm tra ngữ pháp + danh sách lỗi
│   ├── user-menu.tsx               # Menu tài khoản trên header
│   └── claim-guest-data-dialog.tsx # "Nhập tiến độ trên máy này vào tài khoản?"
├── lib/
│   ├── storage.ts                  # Facade: đọc/ghi + hẹn đồng bộ
│   ├── storage-local.ts            # Phần thân localStorage
│   ├── sync.ts                     # Hợp nhất local ↔ server, last-write-wins
│   ├── deck-storage.ts             # Bộ từ đã đăng ký và trạng thái từng thẻ
│   ├── fsrs.ts                     # Bọc ts-fsrs, tuần tự hoá trạng thái thẻ
│   ├── mastery-engine.ts           # Ước lượng độ thành thạo
│   ├── mastery-gate.ts             # Điều kiện lên hạng CEFR
│   ├── session-builder.ts          # Chọn thẻ tới hạn và xen kẽ
│   ├── content-curation.ts         # Chấm điểm từ đáng học, gợi ý bài đọc
│   ├── game-engine.ts              # Logic chung của 5 trò chơi
│   ├── gamification.ts             # Điểm, chuỗi ngày, huy hiệu
│   ├── ai-client.ts                # Gọi Gemini, xoay vòng khoá
│   ├── api-guard.ts                # Kiểm tra đầu vào zod + rate limit
│   ├── rate-limit.ts               # Cửa sổ trượt trong bộ nhớ
│   ├── recording-store.ts          # Lưu bản ghi âm vào IndexedDB
│   └── auth.ts                     # Cấu hình Auth.js
├── server/
│   ├── actions/auth.ts             # Đăng ký tài khoản
│   ├── sync-store.ts               # Đọc/ghi Postgres cho endpoint sync
│   └── sync-schema.ts              # Schema zod của gói đồng bộ
└── prisma/schema.prisma

public/data/
├── decks/          # 4 bộ từ vựng, 10.114 từ
├── reading.json    # 30 bài đọc
└── words.json      # Trục CEFR + tần suất, 4.298 mục

scripts/            # Script dựng dữ liệu, chạy tay khi cần
tests/{unit,integration,e2e}/
```

## Cách dữ liệu được lưu

Local-first. Mọi thao tác ghi vào localStorage trước rồi mới hẹn một lượt đẩy lên
server ở nền — nên app không đứng hình chờ mạng, và mất mạng vẫn học được.

- **Chưa đăng nhập:** dữ liệu chỉ nằm trong localStorage của trình duyệt đó. Xoá dữ
  liệu duyệt web là mất.
- **Lần đầu đăng nhập:** nếu máy có tiến độ cũ, app hỏi có muốn nhập vào tài khoản
  không. Đồng ý thì đẩy toàn bộ lên một lần.
- **Đã đăng nhập:** ghi vào localStorage rồi đồng bộ lên server. Mở ở thiết bị khác
  thì kéo về.
- **Xung đột:** so theo `updatedAt` của từng bản ghi, bản mới hơn thắng. Bỏ đăng ký
  một bộ từ để lại tombstone để việc bỏ đó không bị thiết bị khác ghi đè ngược.

## Biến môi trường

Tất cả đều tuỳ chọn — xem [.env.example](.env.example) để biết chi tiết từng biến.

| Biến | Thiếu thì sao |
|---|---|
| `DATABASE_URL` | Không có tài khoản, không đồng bộ. App chạy chế độ khách |
| `AUTH_SECRET` | Bắt buộc khi đã có `DATABASE_URL` |
| `GEMINI_API_KEYS` | Phân tích bài đọc và sinh quiz báo "chưa cấu hình" |
| `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET` | Không hiện nút đăng nhập GitHub |

## Deploy lên Vercel

1. Tạo database Postgres — [Neon](https://neon.tech) có bậc miễn phí hợp với Vercel.
2. Import repo vào Vercel.
3. Đặt biến môi trường: `DATABASE_URL`, `AUTH_SECRET`, và `GEMINI_API_KEYS` nếu muốn
   bật các tính năng AI.
4. Build command để `npm run vercel-build` (`prisma generate && next build`). Bước
   `generate` phải nằm trong build chứ không chỉ ở `postinstall`: Vercel cache
   `node_modules` nên khi trúng cache, `postinstall` bị bỏ qua và build hỏng vì thiếu
   Prisma Client.
5. Chạy migration một lần: `npm run db:deploy` (hoặc thêm vào build command).

## Đóng góp

Trước khi mở PR, chạy `npm run verify` và `npm run build`. CI kiểm tra đúng bốn bước
đó, nên chạy trước ở máy sẽ nhanh hơn là chờ.

Giao diện và comment trong mã viết bằng tiếng Việt. Tên biến, tên hàm và định danh kỹ
thuật giữ tiếng Anh.
