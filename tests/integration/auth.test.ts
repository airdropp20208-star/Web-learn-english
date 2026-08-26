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

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

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
});
