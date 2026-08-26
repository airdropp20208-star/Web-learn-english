"use client";

import { useSession } from "next-auth/react";

import { DEFAULT_USER_ID } from "@/lib/user-id";

/**
 * Id của người đang dùng app: id thật nếu đã đăng nhập, `DEFAULT_USER_ID` nếu
 * là khách.
 *
 * Trả về khách trong lúc phiên còn đang tải, thay vì `null` hay một trạng thái
 * chờ. Lý do: mọi tab đều nhận `userId` là `string` bắt buộc, và bắt cả cây
 * component chờ session xong mới vẽ sẽ làm app nháy trắng ở mỗi lần tải trang
 * — kể cả khi người dùng chưa từng định đăng nhập. Khi phiên xong,
 * `setActiveUserId` trong Providers đổi kho dữ liệu và mọi store tự nạp lại.
 */
export function useCurrentUserId(): string {
  const { data: session } = useSession();
  return session?.user?.id ?? DEFAULT_USER_ID;
}

/** Đã đăng nhập chưa. `undefined` khi phiên còn đang tải. */
export function useIsSignedIn(): boolean | undefined {
  const { status } = useSession();
  if (status === "loading") return undefined;
  return status === "authenticated";
}
