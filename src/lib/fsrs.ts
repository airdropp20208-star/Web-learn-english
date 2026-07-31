// FSRS card state — replaces the old half-life-based MemoryItem
// Uses ts-fsrs library for state-of-the-art spaced repetition

import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  type Card,
  type RecordLogItem,
} from "ts-fsrs";

// Configure FSRS with default parameters (FSRS-6)
// enable_fuzz: true adds ±10% randomness to scheduling for natural variation
const params = generatorParameters({ enable_fuzz: true });
const f = fsrs(params);

export type ReviewRating = Rating; // 1=Manual, 2=Again, 3=Hard, 4=Good, 5=Easy

export interface FSRSState {
  card: Card; // ts-fsrs card object
  lastReviewDate: string | null; // ISO date of last review
}

/**
 * Create a new FSRS card (for first-time vocabulary).
 */
export function createNewCard(): Card {
  // createEmptyCard is a standalone export from ts-fsrs
  return createEmptyCard(new Date()) as Card;
}

/**
 * Review a card with a given rating (Again/Hard/Good/Easy).
 * Returns updated card + scheduling info (when to review next).
 */
export function reviewCard(
  card: Card,
  rating: ReviewRating
): { card: Card; log: RecordLogItem } {
  const now = new Date();
  const result = f.repeat(card, now) as Record<Rating, { card: Card; log: RecordLogItem }>;
  const { card: updatedCard, log } = result[rating];
  return { card: updatedCard, log };
}

/**
 * Get a preview of scheduling for all 4 ratings (for UI display).
 * Defensive: optional chaining + fallbacks so an unexpected ts-fsrs result
 * shape never crashes the Review tab.
 */
export function previewSchedule(card: Card): Record<
  "again" | "hard" | "good" | "easy",
  { intervalDays: number; dueDate: Date }
> {
  const now = new Date();
  const result = f.repeat(card, now) as Record<
    number,
    { card: Card; log: RecordLogItem } | undefined
  >;

  const mapping: Array<["again" | "hard" | "good" | "easy", number]> = [
    ["again", Rating.Again],
    ["hard", Rating.Hard],
    ["good", Rating.Good],
    ["easy", Rating.Easy],
  ];

  const preview = {} as Record<
    "again" | "hard" | "good" | "easy",
    { intervalDays: number; dueDate: Date }
  >;

  for (const [key, ratingValue] of mapping) {
    const item = result[ratingValue];
    preview[key] = {
      intervalDays: item?.card?.scheduled_days ?? 0,
      dueDate: item?.card?.due ? new Date(item.card.due) : now,
    };
  }

  return preview;
}

/**
 * Serialize FSRS card to JSON for localStorage storage.
 */
export function serializeCard(card: Card): string {
  return JSON.stringify({
    due: card.due instanceof Date ? card.due.toISOString() : card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review:
      card.last_review instanceof Date
        ? card.last_review.toISOString()
        : card.last_review,
  });
}

/**
 * Deserialize FSRS card from JSON.
 */
export function deserializeCard(json: string): Card {
  const obj = JSON.parse(json);
  return {
    due: obj.due ? new Date(obj.due) : new Date(),
    stability: obj.stability ?? 0,
    difficulty: obj.difficulty ?? 0,
    elapsed_days: obj.elapsed_days ?? 0,
    scheduled_days: obj.scheduled_days ?? 0,
    reps: obj.reps ?? 0,
    lapses: obj.lapses ?? 0,
    state: obj.state ?? 0,
    last_review: obj.last_review ? new Date(obj.last_review) : undefined,
  } as Card;
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
