/**
 * Dịch kết quả lỗi của `signIn()` thành câu tiếng Việt cho form đăng nhập.
 *
 * Tách khỏi `sign-in-form.tsx` vì hai lý do. Thứ nhất, đây là logic thuần —
 * vào một chuỗi, ra một chuỗi — nên test được mà không phải dựng React. Thứ
 * hai, form là client component, nên file này tuyệt đối không được import
 * `@/lib/auth`: làm vậy là kéo Prisma, bcryptjs và Auth.js vào bundle trình
 * duyệt (cùng lý do khiến `auth-constants.ts` tồn tại).
 */

/**
 * Tiền tố mã lỗi mà `authorize()` ném ra khi chặn vì quá nhiều lần thử.
 *
 * **Phải khớp với `RATE_LIMITED_CODE_PREFIX` trong `src/lib/auth.ts`.** Không
 * import được từ đó (xem lý do ở đầu file), nên hai bên được ràng bằng một test
 * tích hợp: nó chặn thật rồi đưa mã nhận được qua `thongBaoLoiDangNhap`.
 *
 * Dạng đầy đủ trên đường truyền là `rate_limited:<số giây>`, ví dụ
 * `rate_limited:420`.
 */
export const RATE_LIMITED_CODE_PREFIX = "rate_limited";

/**
 * Đổi số giây thành cụm từ người đọc được.
 *
 * Làm tròn **lên** ở mọi bậc: thà bảo người dùng đợi lâu hơn thực tế một chút
 * còn hơn để họ thử lại sớm rồi lại bị chặn.
 */
export function moTaKhoangDoi(giay: number): string {
  const giayAnToan = Math.max(1, Math.ceil(giay));
  if (giayAnToan < 90) return `${giayAnToan} giây`;
  const phut = Math.ceil(giayAnToan / 60);
  if (phut < 90) return `${phut} phút`;
  return `${Math.ceil(phut / 60)} giờ`;
}

/**
 * Số giây phải đợi, đọc từ mã lỗi; `null` nếu đây không phải lỗi bị chặn.
 *
 * Chấp nhận cả mã trần `rate_limited` (không kèm số) để nếu sau này server đổi
 * cách gửi thì form vẫn hiện đúng loại thông báo, chỉ mất phần thời gian.
 */
export function docSoGiayChoDoi(code: string | undefined): number | null {
  if (!code) return null;
  if (code !== RATE_LIMITED_CODE_PREFIX && !code.startsWith(`${RATE_LIMITED_CODE_PREFIX}:`)) {
    return null;
  }
  const phanSo = Number(code.slice(RATE_LIMITED_CODE_PREFIX.length + 1));
  return Number.isFinite(phanSo) && phanSo > 0 ? phanSo : 0;
}

/** Chế độ của form: đang đăng nhập, hay vừa tạo tài khoản xong. */
export type SignInMode = "signin" | "register";

/**
 * Câu thông báo cho một lần `signIn()` thất bại.
 *
 * Trừ trường hợp bị chặn, thông báo cố tình **không** phân biệt "email không
 * tồn tại" với "sai mật khẩu" — server đã cẩn thận giấu chuyện đó, hiển thị
 * chi tiết ở đây là làm hỏng công sức đó ngay tại bước cuối.
 */
export function thongBaoLoiDangNhap(
  code: string | undefined,
  mode: SignInMode
): string {
  const cho = docSoGiayChoDoi(code);
  if (cho !== null) {
    // Nói rõ là bị chặn tạm thời, nếu không người dùng tưởng mình nhớ nhầm mật
    // khẩu và gõ tiếp — mỗi lần gõ lại đẩy thời gian chặn ra xa thêm.
    return cho > 0
      ? `Bạn thử đăng nhập quá nhiều lần. Đợi ${moTaKhoangDoi(cho)} rồi thử lại.`
      : "Bạn thử đăng nhập quá nhiều lần. Đợi ít phút rồi thử lại.";
  }

  return mode === "register"
    ? "Tạo tài khoản xong nhưng đăng nhập không thành công. Thử đăng nhập lại."
    : "Email hoặc mật khẩu không đúng.";
}
