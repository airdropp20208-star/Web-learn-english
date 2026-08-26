"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { clearAllLocalData, syncNow } from "@/lib/sync";

function initials(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "K";
  return trimmed.slice(0, 1).toUpperCase();
}

function relativeTime(ts: number): string {
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 60) return "vừa xong";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

/**
 * Chọn giao diện sáng / tối / theo hệ thống.
 *
 * Dự án đã cài `next-themes` và có sẵn đủ token màu cho chế độ tối, nhưng
 * chưa từng có nút nào để bật — người dùng bị buộc theo cài đặt hệ điều hành,
 * kể cả khi họ muốn học buổi tối bằng nền tối trên một máy đang để nền sáng.
 *
 * Không cần chống lệch hydrate: menu chỉ được mount khi người dùng mở ra, lúc
 * đó đã ở client và `theme` đã đọc được.
 */
function ThemeRow() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenuRadioGroup
      value={theme ?? "system"}
      onValueChange={setTheme}
    >
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        Giao diện
      </DropdownMenuLabel>
      <DropdownMenuRadioItem value="light" className="cursor-pointer">
        <Sun className="w-4 h-4 mr-2" />
        Sáng
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark" className="cursor-pointer">
        <Moon className="w-4 h-4 mr-2" />
        Tối
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="system" className="cursor-pointer">
        <Monitor className="w-4 h-4 mr-2" />
        Theo hệ thống
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}

/** Dòng trạng thái đồng bộ trong menu. Chỉ hiện khi đã đăng nhập. */
function SyncRow() {
  const { status, lastSyncedAt, error } = useSyncStatus();
  const [busy, setBusy] = useState(false);

  async function handleSync() {
    setBusy(true);
    try {
      await syncNow();
    } finally {
      setBusy(false);
    }
  }

  const spinning = busy || status === "syncing";

  return (
    <DropdownMenuItem
      className="cursor-pointer gap-2"
      // Giữ menu mở: bấm đồng bộ mà menu đóng ngay thì không thấy được kết quả.
      onSelect={(e) => {
        e.preventDefault();
        void handleSync();
      }}
    >
      {status === "error" ? (
        <TriangleAlert className="w-4 h-4 text-destructive shrink-0" />
      ) : status === "offline" ? (
        <CloudOff className="w-4 h-4 text-muted-foreground shrink-0" />
      ) : spinning ? (
        <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
      ) : (
        <Cloud className="w-4 h-4 shrink-0" />
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-sm">
          {status === "error"
            ? "Đồng bộ lỗi"
            : status === "offline"
              ? "Đang ngoại tuyến"
              : spinning
                ? "Đang đồng bộ…"
                : "Đồng bộ ngay"}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          {status === "error" && error
            ? error
            : lastSyncedAt
              ? `Lần cuối ${relativeTime(lastSyncedAt)}`
              : "Chưa đồng bộ lần nào"}
        </span>
      </div>
    </DropdownMenuItem>
  );
}

export function UserMenu() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const signedIn = status === "authenticated" && Boolean(session?.user);
  const displayName =
    session?.user?.name?.trim() || session?.user?.email || "Khách";
  const subtitle = signedIn
    ? (session?.user?.email ?? "Đã đăng nhập")
    : "Dữ liệu lưu trong trình duyệt";

  function handleClearData() {
    clearAllLocalData();
    toast.success("Đã xoá dữ liệu học trên máy này.");
    // Nạp lại thay vì chỉ publish: nhiều component giữ dữ liệu dẫn xuất trong
    // state cục bộ, nạp lại là cách chắc chắn duy nhất để không còn sót.
    window.location.reload();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Tài khoản"
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar className="w-7 h-7">
              {session?.user?.image && (
                <AvatarImage src={session.user.image} alt="" />
              )}
              <AvatarFallback className="text-xs">
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm hidden sm:inline max-w-[120px] truncate">
              {displayName}
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium truncate">{displayName}</span>
              <span className="text-xs text-muted-foreground truncate">
                {subtitle}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {signedIn ? (
            <>
              <SyncRow />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => {
                  void signOut({ redirect: false }).then(() => {
                    // Không xoá localStorage: dữ liệu của tài khoản nằm ở khoá
                    // riêng theo id, đăng nhập lại là thấy nguyên vẹn.
                    router.refresh();
                    toast.success("Đã đăng xuất.");
                  });
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Đăng xuất
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/dang-nhap">
                <LogIn className="w-4 h-4 mr-2" />
                Đăng nhập để đồng bộ
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <ThemeRow />

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Xoá dữ liệu trên máy này
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá dữ liệu học trên máy này?</AlertDialogTitle>
            <AlertDialogDescription>
              {signedIn
                ? "Xoá bản lưu trong trình duyệt. Dữ liệu đã đồng bộ lên tài khoản vẫn còn và sẽ tải lại ở lần đồng bộ kế tiếp."
                : "Toàn bộ từ đã học, tiến độ lộ trình và điểm sẽ mất. Không khôi phục được vì chưa có tài khoản nào giữ bản sao."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearData}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
