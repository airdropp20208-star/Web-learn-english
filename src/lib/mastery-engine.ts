// Mastery Engine — half-life regression heuristic
// Based on brief design with safety clamps to prevent runaway states

import type { MemoryItemDTO, CEFRLevel } from "./types";

// Constants (tunable)
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const FAST_MS = 3000; // < 3s = fast
export const SLOW_MS = 10000; // > 10s = slow
export const GROWTH_BASE = 2.0; // double half-life on correct (base)
export const SHRINK_FACTOR = 0.4; // shrink to 40% on wrong
export const MIN_HALF_LIFE = 0.25; // 6 hours minimum
export const MAX_HALF_LIFE = 365; // 1 year max — prevent items never being due
export const REVIEW_THRESHOLD = 0.85; // below this → due for review
export const TIER_THRESHOLD = 0.85; // avg recall prob to advance tier
export const MIN_SAMPLE_SIZE = 10; // need at least N items to evaluate tier

// CEFR ordering for tier advancement
export const CEFR_ORDER: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/**
 * Estimate recall probability using exponential decay.
 * p = exp(-daysSince / halfLife)
 * Returns 1.0 for items never reviewed (lastReviewedAt = createdAt).
 */
export function estimateRecallProbability(
  item: Pick<MemoryItemDTO, "halfLifeDays" | "lastReviewedAt">,
  now: number = Date.now()
): number {
  const daysSince = Math.max(0, (now - item.lastReviewedAt) / MS_PER_DAY);
  const halfLife = Math.max(MIN_HALF_LIFE, item.halfLifeDays);
  return Math.exp(-daysSince / halfLife);
}

/**
 * Update memory model after a review attempt.
 * Returns new halfLifeDays (clamped) — caller must persist lastReviewedAt + histories.
 */
export function computeUpdatedHalfLife(
  item: Pick<MemoryItemDTO, "halfLifeDays">,
  correct: boolean,
  latencyMs: number
): number {
  let newHalfLife: number;

  if (correct) {
    const speedBonus =
      latencyMs < FAST_MS ? 1.3 : latencyMs > SLOW_MS ? 0.8 : 1.0;
    newHalfLife = item.halfLifeDays * GROWTH_BASE * speedBonus;
  } else {
    newHalfLife = item.halfLifeDays * SHRINK_FACTOR;
  }

  // Clamp to safe range — blind-spot fix from brief
  return Math.min(Math.max(newHalfLife, MIN_HALF_LIFE), MAX_HALF_LIFE);
}

/**
 * Check if a memory item is due for review (recall prob < threshold).
 */
export function isDueForReview(
  item: Pick<MemoryItemDTO, "halfLifeDays" | "lastReviewedAt">,
  now: number = Date.now()
): boolean {
  return estimateRecallProbability(item, now) < REVIEW_THRESHOLD;
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
