"use server";

/**
 * Đăng ký tài khoản bằng email + mật khẩu.
 *
 * Không tự đăng nhập hộ ở đây: `signIn` của Auth.js v5 phải chạy trong ngữ
 * cảnh có quyền ghi cookie theo cách riêng, và gọi nó từ trong một server
 * action tạo tài khoản làm luồng lỗi rối hẳn lên. Client gọi `signIn` ngay sau
 * khi action này trả về `ok`.
 */

import { z } from "zod";

import { hashPassword, isAuthConfigured, PASSWORD_MIN_LENGTH } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

const registerSchema = z.object({
  email: z.email("Email không hợp lệ."),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Mật khẩu cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`)
    .max(200, "Mật khẩu quá dài."),
  name: z.string().trim().max(100).optional(),
});

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string };

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

  const email = parsed.data.email.toLowerCase();
  const prisma = getPrisma();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Nói thẳng ở đây là có chủ đích, khác với lúc đăng nhập. Form đăng ký
    // vốn đã tiết lộ điều này qua chính việc thành công hay thất bại — giấu
    // chỉ làm người dùng bối rối mà không thêm được chút an toàn nào.
    return { ok: false, error: "Email này đã được đăng ký." };
  }

  await prisma.user.create({
    data: {
      email,
      name: parsed.data.name?.trim() || null,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  return { ok: true };
}
