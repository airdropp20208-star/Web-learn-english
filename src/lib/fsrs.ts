// FSRS card state — replaces the old half-life-based MemoryItem
// Uses ts-fsrs library for state-of-the-art spaced repetition

import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  type Card,
  type Grade,
  type ReviewLog,
} from "ts-fsrs";
import type { FSRSCardState } from "./types";

// Configure FSRS with default parameters (FSRS-6)
// enable_fuzz: true adds ±10% randomness to scheduling for natural variation
const params = generatorParameters({ enable_fuzz: true });
const f = fsrs(params);

/**
 * Mức đánh giá một lần ôn. Cố tình dùng `Grade` (Again | Hard | Good | Easy)
 * chứ không phải `Rating`: `Rating.Manual` không phải một câu trả lời của
 * người học, và cho phép nó lọt vào sẽ làm `f.next()` ném lỗi.
 *
 * Giá trị thật của enum: Manual=0, Again=1, Hard=2, Good=3, Easy=4.
 * Luôn dùng tên enum (`Rating.Good`), đừng gõ số trần.
 */
export type ReviewRating = Grade;

export interface FSRSState {
  card: Card; // ts-fsrs card object
  lastReviewDate: string | null; // ISO date of last review
}

/**
 * Create a new FSRS card (for first-time vocabulary).
 */
export function createNewCard(): Card {
  // createEmptyCard is a standalone export from ts-fsrs
  return createEmptyCard(new Date());
}

/**
 * Review a card with a given rating (Again/Hard/Good/Easy).
 * Returns updated card + scheduling info (when to review next).
 */
export function reviewCard(
  card: Card,
  rating: ReviewRating
): { card: Card; log: ReviewLog } {
  return f.next(card, new Date(), rating);
}

/**
 * Get a preview of scheduling for all 4 ratings (for UI display).
 */
export function previewSchedule(card: Card): Record<
  "again" | "hard" | "good" | "easy",
  { intervalDays: number; dueDate: Date }
> {
  const now = new Date();
  const result = f.repeat(card, now);

  const mapping: Array<["again" | "hard" | "good" | "easy", Grade]> = [
    ["again", Rating.Again],
    ["hard", Rating.Hard],
    ["good", Rating.Good],
    ["easy", Rating.Easy],
  ];

  const preview = {} as Record<
    "again" | "hard" | "good" | "easy",
    { intervalDays: number; dueDate: Date }
  >;

  for (const [key, grade] of mapping) {
    const item = result[grade];
    preview[key] = {
      intervalDays: item.card.scheduled_days,
      dueDate: new Date(item.card.due),
    };
  }

  return preview;
}

/**
 * Chuyển Card của ts-fsrs sang dạng lưu trữ phẳng (ngày tháng thành chuỗi ISO).
 *
 * `learning_steps` BẮT BUỘC phải có mặt: đó là vị trí hiện tại của thẻ trong
 * chuỗi bước học/học lại. Bỏ sót nó thì mỗi lần lưu rồi đọc lại, thẻ đang ở
 * giữa chừng sẽ bị kéo về bước 0 và lịch ôn tính sai.
 */
export function toCardState(card: Card): FSRSCardState {
  return {
    due: card.due instanceof Date ? card.due.toISOString() : card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps ?? 0,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review:
      card.last_review instanceof Date
        ? card.last_review.toISOString()
        : (card.last_review ?? null),
  };
}

/**
 * Dựng lại Card của ts-fsrs từ dạng lưu trữ phẳng.
 *
 * Dữ liệu cũ (lưu trước khi sửa lỗi mất `learning_steps`) không có trường này
 * nên mặc định về 0 — thẻ chỉ mất đúng vị trí bước học, không mất cả thẻ.
 */
export function fromCardState(state: FSRSCardState): Card {
  return {
    due: state.due ? new Date(state.due) : new Date(),
    stability: state.stability ?? 0,
    difficulty: state.difficulty ?? 0,
    elapsed_days: state.elapsed_days ?? 0,
    scheduled_days: state.scheduled_days ?? 0,
    learning_steps: state.learning_steps ?? 0,
    reps: state.reps ?? 0,
    lapses: state.lapses ?? 0,
    state: state.state ?? 0,
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  } as Card;
}

/**
 * Serialize FSRS card to JSON for localStorage storage.
 */
export function serializeCard(card: Card): string {
  return JSON.stringify(toCardState(card));
}

/**
 * Deserialize FSRS card from JSON.
 */
export function deserializeCard(json: string): Card {
  return fromCardState(JSON.parse(json) as FSRSCardState);
}

/**
 * Format interval for human display.
 */
export function formatInterval(days: number): string {
  if (days < 1) return "<1d";
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
