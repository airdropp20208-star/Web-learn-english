/**
 * Postgres tạm trong tiến trình, phục vụ qua TCP.
 *
 * Có nó để chạy được test tích hợp và thử migration mà không cần cài Postgres
 * hay Docker. PGlite là bản Postgres biên dịch sang WASM; `pglite-socket` bọc
 * nó bằng đúng giao thức dây của Postgres, nên `pg` — và qua đó cả Prisma —
 * kết nối vào y như một máy chủ thật.
 *
 * Dữ liệu nằm trong bộ nhớ: tắt là mất sạch. Đúng ý đồ — mỗi lần chạy test
 * bắt đầu từ một database trống.
 *
 *     node scripts/pglite-server.mjs        # cổng 5433
 *     PGLITE_PORT=5555 node scripts/pglite-server.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.PGLITE_PORT ?? 5433);
const db = await PGlite.create();
// `maxConnections` mặc định là 1, mà pool của `pg` mở nhiều kết nối cùng lúc —
// để nguyên thì client thứ hai bị đá ra với "Server has closed the connection".
// Để rộng tay: dev server của Next nạp lại module khi sửa file, mỗi lần nạp có
// thể sinh thêm một pool, và chạm trần thì lỗi hiện ra dưới dạng khó hiểu
// "Connection terminated unexpectedly".
const server = new PGLiteSocketServer({
  db,
  port,
  host: "127.0.0.1",
  maxConnections: 100,
});

await server.start();
console.log(`pglite listening on postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
}
