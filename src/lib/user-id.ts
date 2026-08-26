/**
 * Danh tính của người dùng chưa đăng nhập.
 *
 * Toàn bộ dữ liệu học của khách nằm trong localStorage dưới khoá gắn với id
 * này. Khi đăng nhập lần đầu, dữ liệu đó được mời nhập vào tài khoản thật
 * (xem src/lib/sync.ts).
 *
 * Hằng số nằm riêng ở file này chứ không nằm trong `src/lib/auth.ts` vì các
 * component client cần nó, mà `auth.ts` kéo theo Prisma + Auth.js — những thứ
 * không được lọt vào bundle trình duyệt.
 */
export const DEFAULT_USER_ID = "local-user";

/** Id này có phải là khách không (tức chưa đăng nhập). */
export function isGuestId(userId: string): boolean {
  return userId === DEFAULT_USER_ID;
}
