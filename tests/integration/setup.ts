/**
 * Nạp `.env` trước khi bất kỳ module nào đọc `process.env.DATABASE_URL`.
 *
 * Cần thiết vì `src/lib/prisma.ts` đọc biến đó ngay lúc nạp module, không phải
 * lúc gọi hàm — đọc muộn một nhịp là nhận `undefined`.
 */
import "dotenv/config";
