"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Github, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerUser } from "@/server/actions/auth";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth-constants";

type Mode = "signin" | "register";

export function SignInForm({
  callbackUrl,
  gitHubEnabled,
}: {
  callbackUrl: string;
  gitHubEnabled: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === "register") {
        const result = await registerUser({ email, password, name });
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }

      // `redirect: false` để tự xử lý lỗi: mặc định Auth.js đá về trang lỗi
      // của chính nó và người dùng mất sạch những gì vừa gõ.
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError(
          mode === "register"
            ? "Tạo tài khoản xong nhưng đăng nhập không thành công. Thử đăng nhập lại."
            : "Email hoặc mật khẩu không đúng."
        );
        return;
      }

      toast.success(mode === "register" ? "Đã tạo tài khoản." : "Đã đăng nhập.");
      // `refresh()` để server component đọc lại phiên mới; thiếu nó thì layout
      // vẫn giữ trạng thái khách cho tới lần tải trang sau.
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Kiểm tra lại mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card p-6">
      <h1 className="font-semibold text-lg mb-1">
        {mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
      </h1>
      <p className="text-sm text-muted-foreground mb-5">
        {mode === "signin"
          ? "Đăng nhập để tiến độ học đồng bộ giữa các thiết bị."
          : "Tiến độ đang có trên máy này sẽ được mời nhập vào tài khoản mới."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Tên hiển thị (không bắt buộc)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              maxLength={100}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Mật khẩu</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          {mode === "register" && (
            <p className="text-xs text-muted-foreground">
              Ít nhất {PASSWORD_MIN_LENGTH} ký tự.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
        </Button>
      </form>

      {gitHubEnabled && (
        <>
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-2 text-xs text-muted-foreground">
                hoặc
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void signIn("github", { callbackUrl })}
          >
            <Github className="w-4 h-4 mr-2" />
            Tiếp tục với GitHub
          </Button>
        </>
      )}

      <button
        type="button"
        className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => {
          setMode(mode === "signin" ? "register" : "signin");
          setError(null);
        }}
      >
        {mode === "signin"
          ? "Chưa có tài khoản? Tạo mới"
          : "Đã có tài khoản? Đăng nhập"}
      </button>
    </div>
  );
}
