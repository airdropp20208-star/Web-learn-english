"use client";

import { useSyncExternalStore } from "react";
import {
  DAILY_GOAL,
  subscribeGamification,
  getGamificationSnapshot,
  getGamificationServerSnapshot,
  type GamificationState,
} from "@/lib/gamification";

/**
 * Đọc trạng thái điểm/streak và tự vẽ lại khi nó đổi.
 *
 * Dùng `useSyncExternalStore` thay vì `useEffect` + `setState`: React biết đây
 * là kho dữ liệu ngoài, nên xử lý đúng cả lúc hydrate (lần vẽ đầu dùng ảnh chụp
 * phía server, không lệch nội dung) lẫn lúc nhiều component cùng đọc.
 */
export function useGamification(): GamificationState {
  return useSyncExternalStore(
    subscribeGamification,
    getGamificationSnapshot,
    getGamificationServerSnapshot
  );
}

/**
 * `true` khi đã đọc xong dữ liệu thật trên máy người dùng.
 *
 * Trong lần vẽ đầu (server + hydrate) mọi chỉ số đều là 0. Component nào không
 * muốn nháy số 0 rồi mới nhảy sang số thật thì dùng cờ này để hiện khung chờ.
 */
export function useGamificationReady(): boolean {
  return useSyncExternalStore(
    subscribeGamification,
    () => true,
    () => false
  );
}

/** Tiến độ mục tiêu ngày, tính từ cùng một ảnh chụp nên không lệch nhau. */
export function useDailyProgress(): {
  current: number;
  goal: number;
  percent: number;
} {
  const state = useGamification();
  const current =
    state.todayProgress.wordsLearned + state.todayProgress.wordsReviewed;
  return {
    current,
    goal: DAILY_GOAL,
    percent: Math.min(100, (current / DAILY_GOAL) * 100),
  };
}
