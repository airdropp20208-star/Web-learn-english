import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { getPrisma, isDatabaseConfigured } from "./prisma";
import { PASSWORD_MIN_LENGTH } from "./auth-constants";
import {
  checkRateLimit,
  clientIpKey,
  SHARED_FALLBACK_KEY,
  type RateLimitRule,
} from "./rate-limit";

export { DEFAULT_USER_ID } from "./user-id";

/**
 * Cấu hình Auth.js v5.
 *
 * Bốn điều đáng nói:
 *
 * 1. **Chiến lược phiên là JWT, không phải database.** Bắt buộc khi dùng
 *    Credentials provider — provider này không đi qua adapter nên không có
 *    bản ghi `Session` nào để đọc. Bảng `Session` vẫn giữ cho luồng OAuth.
 *
 * 2. **Provider bật theo biến môi trường.** Chưa có `DATABASE_URL` thì không
 *    có provider nào cả, và app chạy nguyên vẹn ở chế độ khách. GitHub OAuth
 *    chỉ xuất hiện khi có đủ `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET`.
 *
 * 3. **Thông báo đăng nhập sai luôn mơ hồ có chủ đích.** Không phân biệt
 *    "email không tồn tại" với "mật khẩu sai" — phân biệt là tặng kẻ tấn công
 *    một công cụ dò xem địa chỉ nào đã đăng ký. Sự mơ hồ đó phải đúng cả về
 *    **thời gian** chứ không chỉ về câu chữ; xem `DUMMY_PASSWORD_HASH`.
 *
 * 4. **`authorize()` tự siết tần suất.** Đây là điểm duy nhất trong app chạy
 *    bcrypt theo yêu cầu của người lạ, nên nó vừa là chỗ dò mật khẩu vừa là
 *    đòn bẩy DoS rẻ tiền. Xem `LOGIN_IP_RULES` và `LOGIN_EMAIL_RULES`.
 */

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
});

// Hằng số mật khẩu sống ở `auth-constants.ts` để client import được mà không
// kéo theo Prisma (xem chú thích trong file đó). Re-export ở đây cho các chỗ
// gọi phía server vốn đã quen lấy từ `auth`.
export { PASSWORD_MIN_LENGTH };

/** Chi phí băm bcrypt. 12 vòng là mức cân bằng thông dụng năm nay. */
const BCRYPT_ROUNDS = 12;

/**
 * Hash giả để so khi email không tồn tại, giữ thời gian phản hồi không đổi.
 *
 * Phải là một chuỗi bcrypt **hợp lệ**: đúng 60 ký tự, gồm `$2b$`, hai chữ số
 * cost, `$`, rồi 53 ký tự salt/digest nằm trong bảng base64 của bcrypt (`0`
 * hợp lệ). Lệch một ký tự thôi là `bcryptjs` nhận ra định dạng hỏng và trả
 * `false` **ngay lập tức, không chạy KDF** — đo được: hash hỏng mất 0 ms còn
 * hash thật mất ~320 ms. Chênh lệch đó chính là kênh dò "địa chỉ nào đã có
 * tài khoản" mà biện pháp này sinh ra để bịt, và nó hỏng một cách lặng lẽ:
 * code vẫn chạy đúng, test vẫn xanh, chỉ có lớp bảo vệ là không còn.
 *
 * Dựng từ `BCRYPT_ROUNDS` thay vì chép cứng, để đổi cost là hash giả đổi theo.
 * Nếu không, cost thật 14 mà hash giả kẹt ở 12 sẽ tái tạo đúng kênh thời gian
 * đó ở mức nhỏ hơn.
 */
const DUMMY_PASSWORD_HASH = `$2b$${String(BCRYPT_ROUNDS).padStart(2, "0")}$${"0".repeat(53)}`;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

const MINUTE = 60_000;

/**
 * Hạn mức đăng nhập theo **IP** — chống lấy trang đăng nhập làm đòn bẩy DoS.
 *
 * Mỗi lượt `authorize()` đốt ~250 ms CPU cho bcrypt 12 vòng, đắt hơn mọi route
 * khác trong app tính trên một request, và không cần đăng nhập được mới tốn.
 * Không chặn thì một script gửi vài chục request mỗi giây là chiếm trọn CPU
 * của instance, mọi người dùng khác mất dịch vụ, dù kẻ tấn công chẳng đoán
 * trúng mật khẩu nào.
 *
 * Nhịp thật: một người đăng nhập một lần rồi phiên JWT sống 30 ngày. Kể cả gõ
 * sai vài lần rồi đổi thiết bị thì 10 lượt/phút vẫn gấp nhiều lần nhu cầu, mà
 * giữ chi phí bcrypt dưới ~2,5 giây CPU mỗi phút (khoảng 4% một nhân).
 *
 * Trần giờ 100 chặn kiểu rỉ rả: chỉ có tầng phút thì 10/phút vẫn là 600/giờ.
 *
 * Lưu ý khi chạy local: không có proxy nào đặt `x-forwarded-for` nên mọi
 * request rơi chung vào `ip:unknown` và cùng ăn một hạn mức.
 */
const LOGIN_IP_RULES: RateLimitRule[] = [
  { name: "login-ip-burst", limit: 10, windowMs: MINUTE },
  { name: "login-ip-hourly", limit: 100, windowMs: 60 * MINUTE },
];

/**
 * Hạn mức đăng nhập theo **email** — chống dội mật khẩu vào một tài khoản.
 *
 * Tầng IP ở trên không đủ: đổi IP (botnet, proxy dân cư) là hạn mức đó reset
 * trong khi mục tiêu vẫn là một tài khoản. Khoá theo email thì đổi bao nhiêu
 * IP cũng vô ích.
 *
 * 5 lượt trong 10 phút: người biết mật khẩu của mình gõ đúng trong 1–3 lần,
 * 5 chừa chỗ cho caps-lock và một lỗi gõ. 10 phút đủ ngắn để người thật sự
 * nhầm không mất cả buổi tối, nhưng kéo tốc độ đoán xuống ~720 lượt/ngày — đủ
 * để một danh sách 10.000 mật khẩu phổ biến mất hai tuần mới quét xong.
 *
 * Hạn mức phải **giống hệt nhau cho email đã đăng ký và chưa đăng ký**. Nếu
 * email lạ bị chặn sớm hơn (hoặc muộn hơn) thì chính việc bị chặn trở thành
 * câu trả lời cho "địa chỉ này có tài khoản không" — đúng thứ mà thông báo lỗi
 * mơ hồ và hash giả đang cố giấu. Vì vậy bộ đếm chạy **trước** khi truy vấn
 * database và không quan tâm user có tồn tại hay không.
 */
const LOGIN_EMAIL_RULES: RateLimitRule[] = [
  { name: "login-email", limit: 5, windowMs: 10 * MINUTE },
];

/**
 * Tiền tố mã lỗi báo "bị chặn tạm thời", gửi kèm số giây: `rate_limited:120`.
 *
 * `authorize()` chỉ có hai kết quả — trả user hoặc trả `null` — mà `null` thì
 * client hiển thị "Email hoặc mật khẩu không đúng.". Người bị chặn sẽ tưởng
 * mình nhớ nhầm mật khẩu và gõ thêm, càng gõ càng kéo dài thời gian chặn. Ném
 * một lớp con của `CredentialsSignin` là cách duy nhất Auth.js cho phép đưa
 * thêm thông tin về client: `@auth/core` bắt lỗi này, đặt `code` vào query
 * string, và `signIn()` của `next-auth/react` trả nó ra ở `result.code`.
 *
 * Mã này **không** tiết lộ gì về tài khoản: nó chỉ phụ thuộc số lượt đã thử,
 * mà số lượt được đếm như nhau cho mọi địa chỉ email.
 *
 * Phía client đọc mã ở `src/app/dang-nhap/sign-in-error.ts` — sửa chuỗi này
 * thì phải sửa cả bên đó. Test tích hợp ràng hai bên với nhau để không lệch.
 */
const RATE_LIMITED_CODE_PREFIX = "rate_limited";

class RateLimitedSignin extends CredentialsSignin {
  constructor(retryAfterSeconds: number) {
    super();
    this.code = `${RATE_LIMITED_CODE_PREFIX}:${retryAfterSeconds}`;
  }
}

export function isGitHubOAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
}

/**
 * Auth có chạy được không — quyết định UI hiện hay ẩn nút đăng nhập.
 *
 * Đòi cả `AUTH_SECRET`, không chỉ database. Thiếu secret thì Auth.js ném
 * `MissingSecret` và MỌI endpoint dưới /api/auth trả 500, kể cả endpoint đọc
 * phiên mà `SessionProvider` gọi ở mỗi lần tải trang. Nói cách khác: có
 * DATABASE_URL mà quên AUTH_SECRET thì app hỏng ngay ở chế độ khách, chứ
 * không phải chỉ mất tính năng đăng nhập.
 */
export function isAuthConfigured(): boolean {
  return isDatabaseConfigured() && Boolean(process.env.AUTH_SECRET);
}

function buildProviders(): NextAuthConfig["providers"] {
  if (!isDatabaseConfigured()) return [];

  const providers: NextAuthConfig["providers"] = [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      // `request` khai báo là `Request | undefined` vì test gọi thẳng
      // `authorize(credentials)` với đúng một tham số. Trong app thì
      // `@auth/core` luôn truyền vào, kèm nguyên header của request gốc.
      async authorize(raw, request: Request | undefined) {
        const parsed = credentialsSchema.safeParse(raw);
        // Dữ liệu sai hình dạng bị chặn trước khi tính hạn mức: nó không tốn
        // bcrypt nên không phải mối lo DoS, mà tính vào hạn mức thì một form
        // gõ dở vài lần đã ăn mất suất đăng nhập của chính người dùng đó.
        if (!parsed.success) return null;

        const { password } = parsed.data;
        const email = parsed.data.email.toLowerCase();

        // Tầng IP trước, vì đó là tầng chống DoS: chặn ở đây thì lượt gọi
        // không kịp ghi vào bộ đếm của email, nên một kẻ tấn công cũng không
        // dùng được IP của mình để khoá cửa tài khoản người khác quá rẻ.
        const byIp = checkRateLimit(
          request ? clientIpKey(request.headers) : SHARED_FALLBACK_KEY,
          LOGIN_IP_RULES
        );
        if (!byIp.allowed) throw new RateLimitedSignin(byIp.retryAfterSeconds);

        // Chuẩn hoá chữ thường trước khi làm khoá, nếu không thì chỉ cần đổi
        // hoa/thường trong email là có ngay hạn mức mới cho cùng tài khoản.
        const byEmail = checkRateLimit(`email:${email}`, LOGIN_EMAIL_RULES);
        if (!byEmail.allowed) throw new RateLimitedSignin(byEmail.retryAfterSeconds);

        const prisma = getPrisma();
        const user = await prisma.user.findUnique({ where: { email } });

        // So sánh cả khi không tìm thấy user, với một hash giả hợp lệ, để thời
        // gian phản hồi không tiết lộ email nào đã tồn tại.
        const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

        if (!user || !user.passwordHash || !ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ];

  if (isGitHubOAuthConfigured()) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      })
    );
  }

  return providers;
}

export const authConfig: NextAuthConfig = {
  adapter: isDatabaseConfigured() ? PrismaAdapter(getPrisma()) : undefined,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/dang-nhap",
  },
  providers: buildProviders(),
  callbacks: {
    // Với strategy JWT, `session.user.id` không tự có — phải chuyền tay qua
    // token. Không có bước này thì mọi server action đều không biết ai đang gọi.
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

/**
 * userId của phiên hiện tại, hoặc `null` nếu là khách.
 *
 * Mọi server action phải lấy userId từ đây, tuyệt đối không nhận từ tham số
 * client gửi lên — nếu không thì bất kỳ ai cũng đọc được dữ liệu của người khác
 * bằng cách đổi một chuỗi trong request.
 */
export async function getSessionUserId(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Như trên nhưng ném lỗi thay vì trả `null`. Dùng cho action bắt buộc đăng nhập. */
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("Chưa đăng nhập.");
  return userId;
}
