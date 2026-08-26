import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, isAuthConfigured, isGitHubOAuthConfigured } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";

export const metadata = {
  title: "Đăng nhập — Learn English",
};

/**
 * Trang đăng nhập / đăng ký.
 *
 * Là server component để hai điều được quyết định trước khi gửi HTML đi: đã
 * đăng nhập rồi thì chuyển hướng thẳng (không nháy form), và biết chắc backend
 * có chạy được auth không. Cái thứ hai quan trọng: dự án chạy được nguyên vẹn
 * ở chế độ khách khi chưa có `DATABASE_URL`, nên trang này phải nói thật là
 * chưa dùng được thay vì hiện một cái form bấm vào là lỗi.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // Phải kiểm cấu hình TRƯỚC khi gọi `auth()`: thiếu AUTH_SECRET thì Auth.js
  // ném MissingSecret và trang đổ lỗi ngay, thay vì hiện thông báo tử tế.
  const configured = isAuthConfigured();
  if (configured) {
    const session = await auth();
    if (session?.user) redirect("/");
  }

  const { callbackUrl } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white font-bold">
          L
        </div>
        <div className="leading-tight">
          <div className="font-semibold">Learn English</div>
          <div className="text-xs text-muted-foreground">Học có lộ trình</div>
        </div>
      </Link>

      {configured ? (
        <SignInForm
          callbackUrl={callbackUrl ?? "/?app=1"}
          gitHubEnabled={isGitHubOAuthConfigured()}
        />
      ) : (
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center">
          <h1 className="font-semibold mb-2">Chưa bật tài khoản</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Máy chủ này chưa cấu hình database nên chưa tạo tài khoản được. Bạn
            vẫn học bình thường ở chế độ khách — tiến độ lưu ngay trong trình
            duyệt.
          </p>
          <Link
            href="/?app=1"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-medium text-white"
          >
            Vào học luôn
          </Link>
        </div>
      )}
    </div>
  );
}
