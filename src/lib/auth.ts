import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { getPrisma, isDatabaseConfigured } from "./prisma";
import { PASSWORD_MIN_LENGTH } from "./auth-constants";

export { DEFAULT_USER_ID } from "./user-id";

/**
 * Cấu hình Auth.js v5.
 *
 * Ba điều đáng nói:
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
 *    một công cụ dò xem địa chỉ nào đã đăng ký.
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

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
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
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        // So sánh cả khi không tìm thấy user, với một hash giả, để thời gian
        // phản hồi không tiết lộ email nào đã tồn tại.
        const hash =
          user?.passwordHash ??
          "$2a$12$0000000000000000000000000000000000000000000000000000";
        const ok = await bcrypt.compare(password, hash);

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
