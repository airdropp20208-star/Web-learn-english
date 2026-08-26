import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Cấu hình riêng cho test tích hợp.
 *
 * Tách khỏi `vitest.config.ts` vì ba lý do không dung hoà được trong một file:
 * môi trường phải là `node` chứ không phải jsdom (Prisma cần socket thật),
 * không dùng `tests/setup.ts` (file đó dựng DOM giả), và bộ này chỉ chạy khi
 * có `DATABASE_URL` nên không thể nằm chung với `npm run test` vốn phải xanh
 * trên mọi máy.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // next-auth import "next/server" và "next/headers" bằng bare specifier.
      // Export map của Next chỉ phục vụ chúng qua bundler, nên ở môi trường
      // node trần Vite không tìm ra file. Trỏ thẳng vào entry point.
      "next/server": fileURLToPath(
        new URL("./node_modules/next/server.js", import.meta.url)
      ),
      "next/headers": fileURLToPath(
        new URL("./node_modules/next/headers.js", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/integration/setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
    // Dùng chung một database nên chạy tuần tự: hai file test song song sẽ
    // giẫm lên bảng của nhau.
    // Bắt Vite xử lý next-auth thay vì để node tự resolve: chỉ khi đi qua
    // Vite thì alias "next/server" ở trên mới có tác dụng.
    server: { deps: { inline: ["next-auth", "@auth/core"] } },
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
