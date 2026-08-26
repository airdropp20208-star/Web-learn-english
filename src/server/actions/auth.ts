"use server";

/**
 * Đăng ký tài khoản bằng email + mật khẩu.
 *
 * Không tự đăng nhập hộ ở đây: `signIn` của Auth.js v5 phải chạy trong ngữ
 * cảnh có quyền ghi cookie theo cách riêng, và gọi nó từ trong một server
 * action tạo tài khoản làm luồng lỗi rối hẳn lên. Client gọi `signIn` ngay sau
 * khi action này trả về `ok`.
 *
 * Đây là một trong hai điểm của app cho người lạ chạy bcrypt (điểm kia là
 * `authorize()` trong `src/lib/auth.ts`), nên nó cũng phải tự siết tần suất —
 * server action không đi qua `api-guard.ts` vì lớp đó nhận `Request` và trả
 * `NextResponse`, hai thứ không tồn tại ở đây.
 */

import { headers } from "next/headers";
import { z } from "zod";

import { hashPassword, isAuthConfigured, PASSWORD_MIN_LENGTH } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import {
  checkRateLimit,
  clientIpKey,
  SHARED_FALLBACK_KEY,
  type RateLimitRule,
} from "@/lib/rate-limit";

const registerSchema = z.object({
  // `.trim()` trước khi kiểm định dạng: bàn phím di động rất hay chèn một dấu
  // cách ở cuối, và để zod đánh trượt vì đúng một ký tự trắng là thứ người
  // dùng không tài nào tự nhìn ra.
  email: z.string().trim().pipe(z.email("Email không hợp lệ.")),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Mật khẩu cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`)
    .max(200, "Mật khẩu quá dài."),
  name: z.string().trim().max(100).optional(),
});

const MINUTE = 60_000;

/**
 * Hạn mức đăng ký, đếm theo IP.
 *
 * Bối cảnh: app học tiếng Anh cá nhân. Một người tạo đúng một tài khoản trong
 * đời; con số ở đây không phải để đo nhu cầu mà để chặn vòng lặp hỏng và bot
 * rải tài khoản. Mỗi lượt tạo thành công còn tốn ~250 ms CPU cho bcrypt, nên
 * đây cũng là một cửa DoS chứ không chỉ là chuyện rác trong bảng `User`.
 *
 * Hai tầng, cùng lý do như `analyze`/`quiz` trong `rate-limit.ts`:
 *
 * - **5 lượt / 10 phút** chặn bấm liên tục. Vẫn dư cho tình huống thật rộng
 *   rãi nhất: cả nhà dùng chung một IP NAT và lần lượt lập tài khoản.
 * - **20 lượt / ngày** chặn kiểu rỉ rả. Không có tầng này thì 5 lượt mỗi 10
 *   phút vẫn là 720 tài khoản một ngày.
 *
 * Đếm cả lượt thất bại vì trùng email — đó chính là hình dạng của một bot dò
 * danh sách địa chỉ, và nó vẫn tốn một truy vấn database mỗi lượt.
 *
 * Một hệ quả cần biết khi chạy local: không có proxy nào đặt `x-forwarded-for`
 * nên mọi lượt rơi chung vào `ip:unknown`, mà Playwright lại dùng lại dev
 * server đang chạy (`reuseExistingServer`). Chạy bộ e2e quá 20 lần trong ngày
 * mà không khởi động lại `next dev` sẽ chạm trần này. Khởi động lại server là
 * bộ đếm về 0 — nó nằm trong bộ nhớ tiến trình.
 */
const REGISTER_RULES: RateLimitRule[] = [
  { name: "register-burst", limit: 5, windowMs: 10 * MINUTE },
  { name: "register-daily", limit: 20, windowMs: 24 * 60 * MINUTE },
];

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Khoá đếm cho người đang gọi.
 *
 * Server action không có object `Request`, header phải lấy qua `headers()` của
 * `next/headers`. Hàm đó ném lỗi khi chạy ngoài ngữ cảnh request (test gọi
 * thẳng `registerUser`), nên bắt lại và rơi về xô chung — chặt tay với người
 * không nhận diện được, chứ không mở toang.
 */
async function khoaDemNguoiGoi(): Promise<string> {
  try {
    return clientIpKey(await headers());
  } catch {
    return SHARED_FALLBACK_KEY;
  }
}

/** Đổi số giây thành cụm từ người đọc được. Làm tròn lên ở mọi bậc. */
function moTaKhoangDoi(giay: number): string {
  const giayAnToan = Math.max(1, Math.ceil(giay));
  if (giayAnToan < 90) return `${giayAnToan} giây`;
  const phut = Math.ceil(giayAnToan / 60);
  if (phut < 90) return `${phut} phút`;
  return `${Math.ceil(phut / 60)} giờ`;
}

/**
 * Prisma báo vi phạm ràng buộc duy nhất bằng mã `P2002`.
 *
 * Nhận dạng bằng thuộc tính `code` thay vì `instanceof
 * PrismaClientKnownRequestError`: lớp lỗi của Prisma 7 nằm trong client sinh
 * ra lúc build, và `instanceof` gãy im lặng khi có hai bản client trong cây
 * `node_modules`. Gãy im lặng ở đây nghĩa là người dùng nhận stack trace thay
 * vì "email đã được đăng ký".
 */
function laTrungRangBuocDuyNhat(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  );
}

const LOI_TRUNG_EMAIL = "Email này đã được đăng ký.";

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<RegisterResult> {
  // Kiểm cả AUTH_SECRET: tạo được tài khoản mà không đăng nhập được thì
  // người dùng chỉ nhận một thông báo thành công vô nghĩa.
  if (!isAuthConfigured()) {
    return {
      ok: false,
      error: "Máy chủ chưa cấu hình tài khoản nên chưa đăng ký được.",
    };
  }

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  // Siết SAU khi dữ liệu đã hợp lệ. Đơn xin sai hình dạng không chạm database
  // cũng không chạm bcrypt nên không phải mối lo, còn tính nó vào hạn mức thì
  // một người gõ hụt mật khẩu bốn lần đã tự khoá cửa trước khi kịp đăng ký.
  const hanMuc = checkRateLimit(await khoaDemNguoiGoi(), REGISTER_RULES);
  if (!hanMuc.allowed) {
    return {
      ok: false,
      error: `Bạn tạo tài khoản quá nhiều lần. Đợi ${moTaKhoangDoi(
        hanMuc.retryAfterSeconds
      )} rồi thử lại.`,
    };
  }

  const email = parsed.data.email.toLowerCase();
  const prisma = getPrisma();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Nói thẳng ở đây là có chủ đích, khác với lúc đăng nhập. Form đăng ký
      // vốn đã tiết lộ điều này qua chính việc thành công hay thất bại — giấu
      // chỉ làm người dùng bối rối mà không thêm được chút an toàn nào.
      return { ok: false, error: LOI_TRUNG_EMAIL };
    }

    await prisma.user.create({
      data: {
        email,
        name: parsed.data.name?.trim() || null,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
  } catch (err) {
    // Kiểm-rồi-tạo là một race: hai request cùng email cùng lúc đều thấy
    // `existing` là null, rồi một trong hai đâm vào ràng buộc duy nhất. Không
    // bắt ở đây thì server action ném ra ngoài và người dùng nhận một lỗi vô
    // nghĩa cho tình huống mà app đã có sẵn câu trả lời tử tế.
    if (laTrungRangBuocDuyNhat(err)) {
      return { ok: false, error: LOI_TRUNG_EMAIL };
    }
    // Mọi lỗi database khác (mất kết nối, hết pool) cũng không được rò ra
    // client: thông điệp của Prisma có cả tên bảng lẫn chuỗi kết nối.
    console.error("[registerUser] Không tạo được tài khoản:", err);
    return {
      ok: false,
      error: "Không tạo được tài khoản lúc này. Thử lại sau ít phút.",
    };
  }

  return { ok: true };
}
