/**
 * Hằng số về tài khoản dùng được ở cả hai phía.
 *
 * Tách khỏi `src/lib/auth.ts` vì lý do y hệt `src/lib/user-id.ts`: form đăng
 * nhập là client component, mà `auth.ts` kéo theo Prisma, bcryptjs và Auth.js.
 * Import nhầm một con số từ đó là lôi cả đống ấy vào bundle trình duyệt.
 */

/** Yêu cầu tối thiểu với mật khẩu. Dùng chung cho đăng ký, đăng nhập và form. */
export const PASSWORD_MIN_LENGTH = 8;

/** Độ dài tối đa của tên hiển thị. */
export const NAME_MAX_LENGTH = 100;
