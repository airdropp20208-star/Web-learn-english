/**
 * Chạy `prisma migrate deploy` trong bước build, nhưng chỉ khi thật sự có
 * database.
 *
 * Vì sao không gọi thẳng `prisma migrate deploy` trong `vercel-build`:
 * app này cố ý chạy được ở chế độ khách, không cần `DATABASE_URL`. Gọi thẳng
 * thì mọi bản deploy chưa cắm database đều đỏ ở bước build — hỏng đúng cái
 * tính năng "dùng thử không cần đăng ký".
 *
 * Còn khi ĐÃ có `DATABASE_URL` mà migrate hỏng thì build phải đỏ. Deploy một
 * bản code mới lên cái schema cũ là cách chắc chắn nhất để hỏng dữ liệu thật
 * của người dùng.
 */

import { spawnSync } from "node:child_process";

const url = (process.env.DATABASE_URL ?? "").trim();

if (!url) {
  console.log(
    "[migrate] Không có DATABASE_URL — bỏ qua migrate. App sẽ chạy ở chế độ khách."
  );
  process.exit(0);
}

console.log("[migrate] Có DATABASE_URL, đang chạy prisma migrate deploy…");

// shell chỉ bật trên Windows vì `npx` ở đó là file .cmd, không spawn trực
// tiếp được. Node in cảnh báo DEP0190 khi làm vậy; ở đây vô hại vì tham số là
// hằng số viết cứng ngay trên, không có gì từ bên ngoài chen vào. Vercel chạy
// Linux nên shell tắt và cảnh báo không xuất hiện trong log build.
const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (r.error) {
  console.error("[migrate] Không chạy được prisma:", r.error.message);
  process.exit(1);
}

if (r.status !== 0) {
  console.error(
    `[migrate] migrate deploy thất bại (mã ${r.status}). Dừng build để không đẩy code mới lên schema cũ.`
  );
  process.exit(r.status ?? 1);
}

console.log("[migrate] Xong.");
