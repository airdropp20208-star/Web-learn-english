"use client";

import { useSyncExternalStore } from "react";

import {
  getServerSyncStatus,
  getSyncStatus,
  subscribeSyncStatus,
  type SyncStatusSnapshot,
} from "@/lib/sync";

/**
 * Trạng thái đồng bộ hiện tại, tự vẽ lại khi nó đổi.
 *
 * Ảnh chụp phía server là một hằng số riêng: lúc render trên server chưa có
 * lần đồng bộ nào, và trả về cùng object mỗi lần giúp React không kêu lệch
 * nội dung khi hydrate.
 */
export function useSyncStatus(): SyncStatusSnapshot {
  return useSyncExternalStore(
    subscribeSyncStatus,
    getSyncStatus,
    getServerSyncStatus
  );
}
