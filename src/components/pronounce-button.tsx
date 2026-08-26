"use client";

import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { pronounce } from "@/lib/speech";

interface PronounceButtonProps {
  /** Từ cần đọc — dùng làm phương án dự phòng khi không có file audio. */
  word: string;
  /** URL file phát âm, nếu có. Chấp nhận cả `null` lẫn `undefined`. */
  audioUrl?: string | null;
  className?: string;
  /** Cỡ icon theo lớp Tailwind. Mặc định hợp với chữ cỡ nhỏ. */
  iconClassName?: string;
}

/**
 * Nút phát âm dùng chung.
 *
 * Trước đây bốn chỗ trong app tự viết lại `new Audio(x).play()` — mỗi chỗ đều
 * bỏ quên Promise và mất kiểu thu hẹp của `audioUrl` bên trong closure. Gom về
 * một chỗ để sửa một lần là xong.
 */
export function PronounceButton({
  word,
  audioUrl,
  className,
  iconClassName = "w-3.5 h-3.5",
}: PronounceButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void pronounce(word, audioUrl);
      }}
      className={cn(
        "text-muted-foreground hover:text-primary transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
        className
      )}
      title={`Nghe phát âm "${word}"`}
      aria-label={`Nghe phát âm "${word}"`}
    >
      <Volume2 className={iconClassName} aria-hidden="true" />
    </button>
  );
}
