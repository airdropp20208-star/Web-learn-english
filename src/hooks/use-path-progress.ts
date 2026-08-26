"use client";

import { useSyncExternalStore } from "react";
import {
  subscribePathProgress,
  getPathProgressSnapshot,
  getPathProgressServerSnapshot,
  type PathProgress,
} from "@/lib/path-progress";

/**
 * Đọc tiến độ lộ trình và tự vẽ lại khi nó đổi.
 *
 * Mọi hàm ghi trong `path-progress.ts` đều đi qua `save()`, mà `save()` báo
 * cho store — nên gọi `recordLessonResult(...)` ở bất cứ đâu là màn hình cập
 * nhật ngay, không cần tự `setProgress` lại kết quả trả về.
 */
export function usePathProgress(): PathProgress {
  return useSyncExternalStore(
    subscribePathProgress,
    getPathProgressSnapshot,
    getPathProgressServerSnapshot
  );
}

/** `true` khi đã đọc xong dữ liệu thật trên máy (không còn là ảnh chụp server). */
export function usePathProgressReady(): boolean {
  return useSyncExternalStore(
    subscribePathProgress,
    () => true,
    () => false
  );
}
