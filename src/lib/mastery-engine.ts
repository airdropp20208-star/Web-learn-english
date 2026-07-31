// Mastery Engine — now using FSRS (Free Spaced Repetition Scheduler)
// Replaces the previous half-life heuristic with state-of-the-art SRS

import type { CEFRLevel } from "./types";

// FSRS constants
export const CEFR_ORDER: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
export const REVIEW_THRESHOLD = 0.85; // below this → due for review (used for stats only)
export const TIER_THRESHOLD = 0.85; // avg recall prob to advance tier
export const MIN_SAMPLE_SIZE = 10;

/**
 * Check if a card is due for review.
 * FSRS cards have a `due` field (ISO date string) — if due <= now, it's due.
 */
export function isCardDue(card: { due: string; reps: number }): boolean {
  if (card.reps === 0) return true; // new card
  return new Date(card.due).getTime() <= Date.now();
}

/**
 * Estimate recall probability for a card (for display purposes).
 * FSRS doesn't expose this directly, but we can estimate from stability + time elapsed.
 * Formula: p = exp(-elapsed / stability) — simplified FSRS retention model.
 */
export function estimateRecallProbability(card: {
  stability: number;
  lastReview: string;
}): number {
  const lastMs = new Date(card.lastReview).getTime();
  const elapsedDays = Math.max(0, (Date.now() - lastMs) / (24 * 60 * 60 * 1000));
  const stability = Math.max(0.01, card.stability);
  return Math.exp(-elapsedDays / stability);
}

/**
 * Get next tier in CEFR sequence.
 */
export function nextTier(currentTier: CEFRLevel): CEFRLevel | null {
  const idx = CEFR_ORDER.indexOf(currentTier);
  if (idx === -1 || idx === CEFR_ORDER.length - 1) return null;
  return CEFR_ORDER[idx + 1];
}

/**
 * Mean utility.
 */
function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
