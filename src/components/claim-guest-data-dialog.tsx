"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { claimGuestData, hasLocalData } from "@/lib/sync";
import { DEFAULT_USER_ID } from "@/lib/user-id";

/**
 * Đã hỏi tài khoản này chưa. Lưu theo id nên mỗi tài khoản chỉ bị hỏi một lần,
 * kể cả khi người dùng bấm "Để sau".
 */
const ASKED_PREFIX = "guest-claim-asked";

function alreadyAsked(userId: string): boolean {
  try {
    return localStorage.getItem(`${ASKED_PREFIX}:${userId}`) === "1";
  } catch {
    // localStorage bị chặn: coi như đã hỏi rồi, thà bỏ sót còn hơn hỏi mãi.
    return true;
  }
}

function markAsked(userId: string): void {
  try {
    localStorage.setItem(`${ASKED_PREFIX}:${userId}`, "1");
  } catch {
    // Bỏ qua — cùng lắm là lần sau hỏi lại.
  }
}

/**
 * Mời nhập tiến độ học của chế độ khách vào tài khoản vừa đăng nhập.
 *
 * Hỏi chứ không tự làm: dữ liệu khách trên một máy dùng chung có thể là của
 * người khác, gộp thầm lặng vào tài khoản là làm bẩn lịch sử ôn tập của họ mà
 * không cách nào gỡ ra.
 */
export function ClaimGuestDataDialog() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    if (alreadyAsked(userId)) return;

    let cancelled = false;
    void hasLocalData(DEFAULT_USER_ID).then((found) => {
      if (cancelled) return;
      if (found) {
        setOpen(true);
      } else {
        // Không có gì để nhập thì cũng coi như đã hỏi xong, khỏi kiểm tra lại
        // ở mỗi lần tải trang.
        markAsked(userId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  async function handleClaim() {
    if (!userId) return;
    setBusy(true);
    try {
      await claimGuestData(userId);
      markAsked(userId);
      setOpen(false);
      toast.success("Đã nhập tiến độ vào tài khoản.");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Nhập không thành công: ${err.message}`
          : "Nhập không thành công."
      );
    } finally {
      setBusy(false);
    }
  }

  function handleSkip() {
    if (userId) markAsked(userId);
    setOpen(false);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) handleSkip();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Nhập tiến độ đang có trên máy này?</AlertDialogTitle>
          <AlertDialogDescription>
            Trước khi đăng nhập, bạn đã học ở chế độ khách trên trình duyệt này.
            Nhập vào tài khoản để đồng bộ sang các thiết bị khác. Nếu tài khoản
            đã có sẵn dữ liệu, hai bên được gộp lại — bản mới hơn của mỗi thẻ
            được giữ.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} onClick={handleSkip}>
            Để sau
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              // Giữ hộp thoại mở trong lúc chạy, để người dùng thấy trạng thái
              // thay vì tưởng đã xong rồi mà thật ra đang lỗi.
              e.preventDefault();
              void handleClaim();
            }}
          >
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Nhập vào tài khoản
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
