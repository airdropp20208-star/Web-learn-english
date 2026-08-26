/**
 * Lớp gác chung cho các route dưới `/api`.
 *
 * Mỗi route handler đều phải làm đúng ba việc trước khi chạm vào tài nguyên
 * đắt tiền: biết ai đang gọi, chặn người gọi quá nhanh, và từ chối dữ liệu vào
 * sai hình dạng. Viết lại ba việc đó ở từng file là cách chắc chắn nhất để một
 * hôm nào đó có một route quên mất một việc. Gom vào đây để chỗ quên lộ ra
 * ngay khi đọc route.
 *
 * File này là phần dính với Next (`NextResponse`). Phần thuật toán đếm nằm ở
 * `./rate-limit` và cố ý không import gì của Next, để test đơn vị chạy được mà
 * không phải dựng cả runtime của framework.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUserId } from "./auth";
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitKey,
  rateLimitMessage,
  type RateLimitRule,
} from "./rate-limit";

/**
 * Kết quả gác cổng. Dạng union để TypeScript bắt lỗi quên kiểm tra: không thể
 * đọc `userId` mà chưa hỏi `ok`.
 */
export type Gate =
  | {
      ok: true;
      /** `null` nghĩa là khách chưa đăng nhập — hợp lệ với hầu hết route ở đây. */
      userId: string | null;
      /** Gắn kèm vào response thành công để client biết còn bao nhiêu suất. */
      headers: Record<string, string>;
    }
  | { ok: false; response: NextResponse };

/**
 * userId của phiên hiện tại, và không bao giờ ném lỗi.
 *
 * Với các route cho khách dùng, phiên đăng nhập chỉ để **đếm hạn mức chính xác
 * hơn**. Nếu Auth.js trục trặc (thiếu biến môi trường, cookie hỏng) thì hạ cấp
 * xuống đếm theo IP chứ không được làm hỏng cả tính năng.
 */
async function resolveUserIdSafely(): Promise<string | null> {
  try {
    return await getSessionUserId();
  } catch (err) {
    console.warn("[api-guard] Không đọc được phiên đăng nhập:", err);
    return null;
  }
}

/**
 * Gác một request: xác định người gọi rồi áp hạn mức.
 *
 * @param options.userId Đã biết sẵn người gọi (route tự kiểm tra session trước
 *   rồi) thì truyền vào để khỏi đọc phiên hai lần.
 * @param options.useSession Đặt `false` cho route không cần biết người gọi là
 *   ai — khi đó luôn đếm theo IP và bỏ hẳn chi phí giải mã JWT.
 */
export async function guardRequest(
  req: Request,
  rules: RateLimitRule | RateLimitRule[],
  options: { userId?: string | null; useSession?: boolean } = {}
): Promise<Gate> {
  const userId =
    options.userId !== undefined
      ? options.userId
      : options.useSession === false
        ? null
        : await resolveUserIdSafely();

  const result = checkRateLimit(rateLimitKey(req.headers, userId), rules);
  const headers = rateLimitHeaders(result);

  if (!result.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: rateLimitMessage(result), retryAfterSeconds: result.retryAfterSeconds },
        { status: 429, headers }
      ),
    };
  }

  return { ok: true, userId, headers };
}

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Đọc body JSON và kiểm tra bằng schema zod.
 *
 * Trả 400 kèm `issues` như `/api/sync` vẫn làm — cắt ở 10 mục vì một payload
 * sai hình dạng có thể sinh ra hàng nghìn lỗi, và dội hết về client vừa vô ích
 * vừa là một kênh khuếch đại băng thông.
 */
export async function readJson<S extends z.ZodType>(
  req: Request,
  schema: S
): Promise<ParsedBody<z.output<S>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Body không phải JSON hợp lệ." }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Dữ liệu gửi lên không hợp lệ.", issues: parsed.error.issues.slice(0, 10) },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Mã ngôn ngữ kiểu BCP-47 rút gọn: `en`, `vi`, `en-US`, `zh-Hant`.
 *
 * Không phải kiểm tra cho có. Hai chỗ dùng nó đều nối thẳng giá trị này vào
 * request đi ra ngoài — `/api/translate` ghép vào query string của Google
 * (không hề đi qua `encodeURIComponent`), `/api/grammar` ghép vào form body của
 * LanguageTool. Thả tự do thì client nhét được tham số lạ vào request mà máy
 * chủ ta gửi đi. Danh sách trắng ký tự chặn đứng chuyện đó.
 */
export const languageCodeSchema = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, "Mã ngôn ngữ không hợp lệ.");
