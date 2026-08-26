import { describe, expect, it } from "vitest";

import {
  docSoGiayChoDoi,
  moTaKhoangDoi,
  RATE_LIMITED_CODE_PREFIX,
  thongBaoLoiDangNhap,
} from "@/app/dang-nhap/sign-in-error";

/**
 * Phần logic thuần của form đăng nhập: đọc `result.code` mà `signIn()` trả về
 * rồi quyết định hiển thị câu gì.
 *
 * Đáng test riêng vì đây là chỗ dễ làm hỏng công sức giấu thông tin của server
 * nhất — chỉ cần một nhánh `if` nói rõ "email không tồn tại" là mọi biện pháp
 * chống dò tài khoản ở `authorize()` thành vô nghĩa.
 */

describe("moTaKhoangDoi", () => {
  it("dưới 90 giây thì nói bằng giây", () => {
    expect(moTaKhoangDoi(1)).toBe("1 giây");
    expect(moTaKhoangDoi(45)).toBe("45 giây");
    expect(moTaKhoangDoi(89)).toBe("89 giây");
  });

  it("đổi sang phút rồi sang giờ khi con số bắt đầu khó đọc", () => {
    expect(moTaKhoangDoi(90)).toBe("2 phút");
    expect(moTaKhoangDoi(600)).toBe("10 phút");
    expect(moTaKhoangDoi(5340)).toBe("89 phút");
    expect(moTaKhoangDoi(5400)).toBe("2 giờ");
    expect(moTaKhoangDoi(86_400)).toBe("24 giờ");
  });

  it("luôn làm tròn lên, không bao giờ hứa ngắn hơn thực tế", () => {
    // Bảo đợi 1 phút trong khi còn 61 giây là người dùng thử lại và ăn chặn
    // lần nữa — mỗi lần như vậy lại đẩy thời gian chặn ra xa thêm.
    expect(moTaKhoangDoi(120.1)).toBe("3 phút");
    expect(moTaKhoangDoi(0)).toBe("1 giây");
    expect(moTaKhoangDoi(-5)).toBe("1 giây");
  });
});

describe("docSoGiayChoDoi", () => {
  it("nhận ra mã bị chặn và lấy đúng số giây", () => {
    expect(docSoGiayChoDoi(`${RATE_LIMITED_CODE_PREFIX}:420`)).toBe(420);
    expect(docSoGiayChoDoi(`${RATE_LIMITED_CODE_PREFIX}:1`)).toBe(1);
  });

  it("mã trần không kèm số vẫn tính là bị chặn", () => {
    // Phòng khi server đổi cách gửi: thà mất phần thời gian còn hơn hiển thị
    // nhầm thành "sai mật khẩu".
    expect(docSoGiayChoDoi(RATE_LIMITED_CODE_PREFIX)).toBe(0);
    expect(docSoGiayChoDoi(`${RATE_LIMITED_CODE_PREFIX}:khong-phai-so`)).toBe(0);
  });

  it("mã khác và mã rỗng thì trả null", () => {
    // "credentials" là mã mặc định Auth.js dùng khi `authorize()` trả `null`.
    expect(docSoGiayChoDoi("credentials")).toBeNull();
    expect(docSoGiayChoDoi(undefined)).toBeNull();
    expect(docSoGiayChoDoi("")).toBeNull();
    // Trùng tiền tố nhưng không phải cùng một mã.
    expect(docSoGiayChoDoi(`${RATE_LIMITED_CODE_PREFIX}_khac`)).toBeNull();
  });
});

describe("thongBaoLoiDangNhap", () => {
  it("bị chặn thì nói rõ là bị chặn, kèm thời gian đợi", () => {
    const msg = thongBaoLoiDangNhap(`${RATE_LIMITED_CODE_PREFIX}:120`, "signin");
    expect(msg).toContain("quá nhiều lần");
    expect(msg).toContain("2 phút");
  });

  it("bị chặn mà không biết thời gian thì vẫn nói là bị chặn", () => {
    const msg = thongBaoLoiDangNhap(RATE_LIMITED_CODE_PREFIX, "signin");
    expect(msg).toContain("quá nhiều lần");
  });

  it("sai thông tin đăng nhập thì thông báo mơ hồ, không hé lộ email nào tồn tại", () => {
    const msg = thongBaoLoiDangNhap("credentials", "signin");
    expect(msg).toBe("Email hoặc mật khẩu không đúng.");
    // Mã lạ và không có mã đều phải rơi vào đúng câu đó — nếu một nhánh nào
    // rẽ sang câu khác thì chính câu chữ trở thành kênh phân biệt.
    expect(thongBaoLoiDangNhap(undefined, "signin")).toBe(msg);
    expect(thongBaoLoiDangNhap("MotMaLaHoacToanh", "signin")).toBe(msg);
  });

  it("vừa đăng ký xong mà đăng nhập hỏng thì nói đúng bối cảnh đó", () => {
    // Ở chế độ này "email hoặc mật khẩu không đúng" là vô lý: người dùng vừa
    // tự đặt mật khẩu xong một giây trước.
    const msg = thongBaoLoiDangNhap("credentials", "register");
    expect(msg).toContain("Tạo tài khoản xong");
  });

  it("bị chặn thì báo giống nhau ở cả hai chế độ", () => {
    const code = `${RATE_LIMITED_CODE_PREFIX}:300`;
    expect(thongBaoLoiDangNhap(code, "register")).toBe(
      thongBaoLoiDangNhap(code, "signin")
    );
  });
});
