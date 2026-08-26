/**
 * Test tích hợp cho đăng ký và kiểm tra mật khẩu.
 *
 * Cùng điều kiện chạy như `sync-store.test.ts`: cần `DATABASE_URL`. Xem đầu
 * file đó để biết cách dựng database tạm.
 *
 * Điểm đáng test nhất ở đây không phải "tạo được user" mà là `authorize()` —
 * hàm quyết định một lần đăng nhập thành hay bại. Nó là ranh giới bảo mật thật
 * sự của app, và nó nằm bên trong cấu hình Auth.js nên rất dễ bị bỏ quên.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { resetRateLimitStore } from "@/lib/rate-limit";
import { thongBaoLoiDangNhap } from "@/app/dang-nhap/sign-in-error";

const hasDb = Boolean(process.env.DATABASE_URL);

/** Auth.js từ chối chạy nếu thiếu secret. Giá trị chỉ dùng trong test. */
process.env.AUTH_SECRET ??= "test-secret-khong-dung-o-dau-khac";

const EMAIL = "auth-it-nguoi-dung@example.test";
const PASSWORD = "matkhau-du-dai-123";

type Authorize = (
  credentials: Record<string, unknown>
) => Promise<{ id: string; email: string | null } | null>;

describe.skipIf(!hasDb)("đăng ký và đăng nhập trên Postgres thật", () => {
  let prisma: PrismaClient;
  let registerUser: typeof import("@/server/actions/auth").registerUser;
  let authorize: Authorize;

  beforeAll(async () => {
    prisma = (await import("@/lib/prisma")).getPrisma();
    registerUser = (await import("@/server/actions/auth")).registerUser;

    const { authConfig } = await import("@/lib/auth");
    const credentials = authConfig.providers.find(
      (p) => "id" in p && p.id === "credentials"
    ) as { authorize?: unknown; options?: { authorize?: unknown } } | undefined;
    if (!credentials) {
      throw new Error("Không tìm thấy Credentials provider — cấu hình auth sai.");
    }
    // Cái bẫy: `Credentials()` trả về một object có sẵn `authorize: () => null`
    // và nhét cấu hình thật của mình vào `options`. `@auth/core` mới trộn hai
    // lớp đó lúc xử lý request. Đọc thẳng `.authorize` là lấy nhầm cái stub
    // luôn trả null — test sẽ "thất bại" trong khi app chạy hoàn toàn đúng.
    const fn = credentials.options?.authorize ?? credentials.authorize;
    if (typeof fn !== "function") {
      throw new Error("Credentials provider không có authorize.");
    }
    authorize = fn as Authorize;

    await prisma.user.deleteMany({ where: { email: { startsWith: "auth-it-" } } });
  });

  // Bộ đếm hạn mức là trạng thái cấp module, dùng chung cho cả tiến trình:
  // không dọn thì lượt đăng nhập của test trước làm test sau bị chặn oan, và
  // thứ tự chạy tự nhiên trở thành một phần của điều kiện thành công.
  beforeEach(() => resetRateLimitStore());

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { email: { startsWith: "auth-it-" } } });
    await prisma.$disconnect();
  });

  it("tạo tài khoản và băm mật khẩu chứ không lưu thô", async () => {
    const result = await registerUser({
      email: EMAIL,
      password: PASSWORD,
      name: "  Người Học  ",
    });
    expect(result.ok).toBe(true);

    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    expect(user).not.toBeNull();
    expect(user?.name).toBe("Người Học"); // đã trim
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.passwordHash).not.toBe(PASSWORD);
    expect(user?.passwordHash?.startsWith("$2")).toBe(true); // định dạng bcrypt
  });

  it("email được chuẩn hoá về chữ thường", async () => {
    const result = await registerUser({
      email: "AUTH-IT-HOA@Example.Test",
      password: PASSWORD,
    });
    expect(result.ok).toBe(true);

    const user = await prisma.user.findUnique({
      where: { email: "auth-it-hoa@example.test" },
    });
    expect(user).not.toBeNull();
  });

  it("không cho đăng ký trùng email", async () => {
    const result = await registerUser({ email: EMAIL, password: PASSWORD });
    expect(result).toEqual({ ok: false, error: "Email này đã được đăng ký." });
  });

  it("từ chối mật khẩu quá ngắn và không tạo user", async () => {
    const email = "auth-it-ngan@example.test";
    const result = await registerUser({ email, password: "ngan" });
    expect(result.ok).toBe(false);

    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it("từ chối email sai định dạng", async () => {
    const result = await registerUser({ email: "khong-phai-email", password: PASSWORD });
    expect(result.ok).toBe(false);
  });

  it("đăng nhập đúng mật khẩu thì trả về user", async () => {
    const user = await authorize({ email: EMAIL, password: PASSWORD });
    expect(user).not.toBeNull();
    expect(user?.email).toBe(EMAIL);
  });

  it("sai mật khẩu thì trả null", async () => {
    expect(await authorize({ email: EMAIL, password: "sai-mat-khau-roi" })).toBeNull();
  });

  it("email chưa đăng ký thì trả null", async () => {
    expect(
      await authorize({ email: "auth-it-khong-co@example.test", password: PASSWORD })
    ).toBeNull();
  });

  it("mật khẩu ngắn bị chặn ngay ở schema, không chạm tới database", async () => {
    expect(await authorize({ email: EMAIL, password: "abc" })).toBeNull();
  });

  it("tài khoản không có mật khẩu (chỉ OAuth) không đăng nhập bằng mật khẩu được", async () => {
    // Kịch bản thật: người dùng đăng ký qua GitHub, `passwordHash` là null.
    // Nếu `authorize` chỉ so hash mà quên kiểm null, một chuỗi rỗng có thể lọt.
    const email = "auth-it-oauth@example.test";
    await prisma.user.create({ data: { email, passwordHash: null } });

    expect(await authorize({ email, password: PASSWORD })).toBeNull();
    expect(await authorize({ email, password: "" })).toBeNull();
  });

  /**
   * Gọi `fn` và trả về lỗi nó ném ra.
   *
   * `expect(...).rejects` không dùng được ở đây vì cái cần soi là thuộc tính
   * `code` của lỗi — chính là thứ Auth.js chuyển về client.
   */
  async function batLoi(fn: () => Promise<unknown>): Promise<{ code?: string }> {
    try {
      await fn();
    } catch (err) {
      return err as { code?: string };
    }
    throw new Error("Mong đợi bị chặn nhưng lượt gọi lại trót lọt.");
  }

  const MAT_KHAU_SAI = "chac-chan-khong-phai-mat-khau";

  /**
   * Lượt thứ mấy thì `email` bị chặn. Trả `-1` nếu chưa chặn sau 12 lượt.
   *
   * Dọn bộ đếm ngay đầu hàm để mỗi lần đo bắt đầu từ nền sạch — cần thiết vì
   * hai lần đo trong cùng một test dùng chung xô hạn mức theo IP.
   */
  async function luotBiChan(email: string): Promise<number> {
    resetRateLimitStore();
    for (let luot = 1; luot <= 12; luot++) {
      try {
        await authorize({ email, password: MAT_KHAU_SAI });
      } catch {
        return luot;
      }
    }
    return -1;
  }

  it("chặn dò mật khẩu: sau 5 lượt sai thì email đó bị khoá tạm", async () => {
    const email = "auth-it-do-mat-khau@example.test";
    expect((await registerUser({ email, password: PASSWORD })).ok).toBe(true);

    for (let luot = 0; luot < 5; luot++) {
      expect(await authorize({ email, password: MAT_KHAU_SAI })).toBeNull();
    }

    const loi = await batLoi(() => authorize({ email, password: MAT_KHAU_SAI }));
    expect(loi.code).toMatch(/^rate_limited:\d+$/);

    // Quan trọng hơn cả: đúng mật khẩu cũng không lọt trong lúc bị chặn. Nếu
    // lượt thứ 6 vẫn được kiểm tra thì kẻ dò chỉ mất một lượt mỗi cửa sổ chứ
    // không bị chặn thật.
    const loiDungMatKhau = await batLoi(() => authorize({ email, password: PASSWORD }));
    expect(loiDungMatKhau.code).toMatch(/^rate_limited:/);
  });

  it("email đã đăng ký và email lạ bị chặn ở đúng cùng một lượt", async () => {
    // Đây là bài test chống dò tài khoản. Nếu email chưa tồn tại bị chặn sớm
    // hơn (hoặc muộn hơn) email đã đăng ký thì chỉ cần đếm số lượt là biết
    // được địa chỉ nào có tài khoản — đúng thứ mà thông báo lỗi mơ hồ và hash
    // giả đang cố giấu, bị chính lớp rate limit làm hỏng.
    const daDangKy = "auth-it-co-that@example.test";
    expect((await registerUser({ email: daDangKy, password: PASSWORD })).ok).toBe(true);

    expect(await luotBiChan(daDangKy)).toBe(6);
    expect(await luotBiChan("auth-it-chua-he-ton-tai@example.test")).toBe(6);
  });

  it("chặn theo IP trước khi hạn mức email kịp bảo vệ nhiều tài khoản khác nhau", async () => {
    // Mỗi lượt một email khác nhau nên hạn mức theo email (5) không bao giờ
    // chạm tới; cái phải chặn ở đây là hạn mức theo IP (10/phút), thứ duy nhất
    // ngăn một script quét cả danh sách địa chỉ.
    for (let luot = 1; luot <= 10; luot++) {
      expect(
        await authorize({ email: `auth-it-quet-${luot}@example.test`, password: MAT_KHAU_SAI })
      ).toBeNull();
    }

    const loi = await batLoi(() =>
      authorize({ email: "auth-it-quet-11@example.test", password: MAT_KHAU_SAI })
    );
    expect(loi.code).toMatch(/^rate_limited:/);
  });

  it("mã lỗi bị chặn hiển thị được thành câu tiếng Việt ở form đăng nhập", async () => {
    // Ràng hai đầu với nhau: `src/lib/auth.ts` sinh mã, `sign-in-error.ts` đọc
    // mã. Hai file không import được của nhau (một bên kéo theo Prisma, bên kia
    // chạy trong trình duyệt) nên nếu chuỗi mã lệch nhau thì chỉ test này thấy.
    const email = "auth-it-ma-loi@example.test";
    for (let luot = 0; luot < 5; luot++) {
      await authorize({ email, password: MAT_KHAU_SAI });
    }

    const loi = await batLoi(() => authorize({ email, password: MAT_KHAU_SAI }));
    const cau = thongBaoLoiDangNhap(loi.code, "signin");
    expect(cau).toContain("quá nhiều lần");
    expect(cau).not.toBe("Email hoặc mật khẩu không đúng.");
  });

  it("email chưa đăng ký tốn thời gian tương đương email đã đăng ký", async () => {
    // Hash giả phải là chuỗi bcrypt hợp lệ, nếu không `bcryptjs` phát hiện
    // định dạng hỏng và trả `false` trong 0 ms trong khi email có thật mất
    // ~320 ms. Chênh lệch đó là một kênh dò tài khoản chính xác đến mức đo
    // bằng đồng hồ trình duyệt cũng thấy.
    //
    // Đây là một khẳng định về thời gian nên ngưỡng để rất rộng (chỉ cần cùng
    // bậc độ lớn): lỗi thật làm tỉ lệ tụt về 0, chứ không phải về 0,4.
    // Tự tạo tài khoản trong test thay vì mượn của test trước: nếu mượn thì
    // chạy riêng test này (`-t`) sẽ đo hai email đều không tồn tại, hai số đo
    // bằng nhau, và bài test âm thầm không còn khẳng định điều gì.
    const coThat = "auth-it-do-thoi-gian@example.test";
    expect((await registerUser({ email: coThat, password: PASSWORD })).ok).toBe(true);

    // Lượt làm nóng: lần gọi bcrypt đầu tiên của tiến trình luôn chậm hơn hẳn,
    // và nếu nó rơi vào phép đo đầu thì tỉ lệ lệch mà không phải do lỗi.
    await authorize({ email: "auth-it-lam-nong@example.test", password: MAT_KHAU_SAI });
    resetRateLimitStore();

    const batDauCoThat = performance.now();
    await authorize({ email: coThat, password: MAT_KHAU_SAI });
    const giayCoThat = performance.now() - batDauCoThat;

    const batDauKhongCo = performance.now();
    await authorize({ email: "auth-it-vo-danh@example.test", password: MAT_KHAU_SAI });
    const giayKhongCo = performance.now() - batDauKhongCo;

    expect(giayKhongCo).toBeGreaterThan(giayCoThat / 3);
  });

  it("chặn spam đăng ký sau 5 tài khoản từ cùng một IP", async () => {
    for (let luot = 1; luot <= 5; luot++) {
      const result = await registerUser({
        email: `auth-it-spam-${luot}@example.test`,
        password: PASSWORD,
      });
      expect(result.ok).toBe(true);
    }

    const email = "auth-it-spam-6@example.test";
    const result = await registerUser({ email, password: PASSWORD });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("quá nhiều lần");

    // Lượt bị chặn phải dừng trước khi chạm database, không phải chỉ báo lỗi
    // sau khi đã tạo xong.
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it("dữ liệu đăng ký sai hình dạng không tiêu mất suất trong hạn mức", async () => {
    // Người gõ hụt mật khẩu bốn lần không đáng bị khoá cửa trước khi kịp đăng
    // ký, và những lượt đó không tốn bcrypt nên cũng không phải mối lo DoS.
    for (let luot = 0; luot < 8; luot++) {
      expect((await registerUser({ email: "auth-it-hut@example.test", password: "ngan" })).ok).toBe(
        false
      );
    }

    const result = await registerUser({
      email: "auth-it-sau-khi-hut@example.test",
      password: PASSWORD,
    });
    expect(result.ok).toBe(true);
  });
});
