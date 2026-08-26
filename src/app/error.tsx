"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Lưới cuối cùng trong phạm vi layout: bắt những lỗi thoát khỏi mọi
 * `ErrorBoundary` của từng tab, gồm cả lỗi ném ra lúc render trên máy chủ.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Ứng dụng gặp lỗi</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Tiến độ học của bạn được lưu trong máy nên không mất. Thử tải lại
          trang; nếu vẫn lỗi thì đóng tab rồi mở lại.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Thử lại
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Tải lại trang
        </Button>
      </div>

      {/* `digest` là mã Next.js gán cho lỗi phía máy chủ — không lộ nội dung
          lỗi ra ngoài, nhưng đủ để dò lại trong log. */}
      {error.digest && (
        <p className="text-xs text-muted-foreground">Mã lỗi: {error.digest}</p>
      )}
    </div>
  );
}
