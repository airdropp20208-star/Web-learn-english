import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Cấu hình cho Prisma CLI (migrate, db push, studio…).
 *
 * Từ Prisma 7, chuỗi kết nối không còn nằm trong `schema.prisma` nữa. Runtime
 * lấy kết nối qua driver adapter ở `src/lib/prisma.ts`; chỉ các lệnh CLI mới
 * đọc file này.
 *
 * `datasource` để tuỳ chọn có chủ đích: `prisma generate` phải chạy được khi
 * chưa có `DATABASE_URL` — nếu không thì `npm install` trên máy mới, hay bước
 * build đầu tiên trên CI, sẽ hỏng chỉ vì thiếu một biến mà nó không cần.
 * Các lệnh thật sự cần database sẽ tự báo lỗi thiếu datasource.
 */
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
