/**
 * Màu của huy hiệu cấp độ và nhãn bộ từ.
 *
 * Bảng CEFR trước đây được chép nguyên xi ở năm tab — sửa một chỗ là bốn chỗ
 * còn lại lệch đi mà không ai biết. Gộp về một nguồn, và nhân thể vá luôn chế
 * độ tối: bản cũ chỉ có sắc 100/700, nên trên nền tối mấy con chip sáng trắng
 * đập vào mắt giữa một trang tối.
 *
 * Sắc dùng cho nền tối lấy 950 làm nền và 300 làm chữ — cùng cặp mà thanh
 * header đã dùng cho viên xu và viên chuỗi ngày, để cả app nhất quán.
 */

import type { CEFRLevel } from "./types";

export const CEFR_COLOR: Record<CEFRLevel, string> = {
  A1: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
  A2: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
  B1: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
  B2: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900",
  C1: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900",
  C2: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
};

export const CATEGORY_COLOR: Record<string, string> = {
  TOEIC: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900",
  IELTS: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900",
  Oxford: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
  Daily: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
  Essential: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900",
  CEFR: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900",
};
