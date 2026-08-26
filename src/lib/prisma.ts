import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma client dùng chung cho toàn server.
 *
 * Hai điều quan trọng:
 *
 * 1. **Singleton qua globalThis.** Ở dev, Next.js nạp lại module mỗi lần sửa
 *    file; tạo client mới mỗi lần sẽ mở thêm một pool kết nối và rất nhanh làm
 *    Postgres hết slot. Cách chuẩn là gắn instance vào `globalThis` để lần nạp
 *    sau dùng lại. Ở production chỉ nạp một lần nên không cần.
 *
 * 2. **Không ném lỗi lúc import.** Nếu thiếu `DATABASE_URL`, module này vẫn
 *    nạp được và `isDatabaseConfigured()` trả về false. App chạy ở chế độ
 *    khách (localStorage) thay vì sập trắng — quan trọng vì đây đúng là trạng
 *    thái của dự án cho tới khi có Neon ở Phase 6.
 */

const connectionString = process.env.DATABASE_URL;

export function isDatabaseConfigured(): boolean {
  return typeof connectionString === "string" && connectionString.length > 0;
}

function createClient(): PrismaClient {
  if (!connectionString) {
    throw new Error(
      "Thiếu DATABASE_URL. Đặt biến này trong .env (xem .env.example) trước khi dùng các tính năng cần database."
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let cached: PrismaClient | undefined = globalForPrisma.prisma;

/**
 * Lấy client. Ném lỗi rõ ràng nếu chưa cấu hình database — gọi
 * `isDatabaseConfigured()` trước nếu muốn rẽ nhánh thay vì bắt lỗi.
 */
export function getPrisma(): PrismaClient {
  if (!cached) {
    cached = createClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = cached;
    }
  }
  return cached;
}
