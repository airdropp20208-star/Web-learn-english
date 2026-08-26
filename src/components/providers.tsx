"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { SessionProvider, useSession } from "next-auth/react";

import { ClaimGuestDataDialog } from "@/components/claim-guest-data-dialog";
import { setActiveUserId } from "@/lib/active-user";
import { startSyncEngine } from "@/lib/sync";
import { DEFAULT_USER_ID } from "@/lib/user-id";

/**
 * Nối phiên đăng nhập vào tầng lưu trữ.
 *
 * Mọi kho localStorage đều phân vùng theo id người dùng đang hoạt động (xem
 * `src/lib/active-user.ts`). Component này là chỗ duy nhất đặt id đó, và nó
 * cũng bật engine đồng bộ.
 *
 * Không vẽ gì cả — nó chỉ tồn tại để chạy hai effect này ở nơi đã có
 * `SessionProvider` bao ngoài.
 */
function AuthBridge() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? DEFAULT_USER_ID;

  useEffect(() => {
    // Trong lúc phiên còn tải thì chưa đổi gì: đổi sang khách rồi lại đổi về
    // tài khoản thật sẽ khiến các store nạp lại hai lần và UI nháy số liệu.
    if (status === "loading") return;
    setActiveUserId(userId);
  }, [userId, status]);

  useEffect(() => startSyncEngine(), []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthBridge />
        <ClaimGuestDataDialog />
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
