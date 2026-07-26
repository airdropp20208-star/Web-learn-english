// Mastery Gate — check tier advancement conditions

import type { MemoryItemDTO, CEFRLevel } from "./types";
import {
  estimateRecallProbability,
  CEFR_ORDER,
  TIER_THRESHOLD,
  MIN_SAMPLE_SIZE,
} from "./mastery-engine";

/**
 * Check if user is ready to advance to next CEFR tier.
 * Conditions:
 * 1. Enough items in current tier (MIN_SAMPLE_SIZE)
 * 2. Average recall probability >= TIER_THRESHOLD
 * 3. Not at C2 already
 */
export function checkTierAdvancement(
  items: MemoryItemDTO[],
  currentTier: CEFRLevel,
  now: number = Date.now()
): { canAdvance: boolean; nextTier: CEFRLevel | null; avgP: number; sampleSize: number } {
  const nextTierIdx = CEFR_ORDER.indexOf(currentTier) + 1;
  const nextTier: CEFRLevel | null =
    nextTierIdx < CEFR_ORDER.length ? CEFR_ORDER[nextTierIdx] : null;

  // Filter items in current tier (cefrLevel === currentTier)
  const active = items.filter((i) => i.cefrLevel === currentTier);

  if (active.length < MIN_SAMPLE_SIZE) {
    return {
      canAdvance: false,
      nextTier,
      avgP: 0,
      sampleSize: active.length,
    };
  }

  const avgP =
    active.reduce((sum, i) => sum + estimateRecallProbability(i, now), 0) /
    active.length;

  return {
    canAdvance: avgP >= TIER_THRESHOLD && nextTier !== null,
    nextTier,
    avgP,
    sampleSize: active.length,
  };
}

/**
 * Compute current tier mastery score (avg recall prob of items in current tier).
 */
export function computeTierMasteryScore(
  items: MemoryItemDTO[],
  currentTier: CEFRLevel,
  now: number = Date.now()
): number {
  const active = items.filter((i) => i.cefrLevel === currentTier);
  if (active.length === 0) return 0;
  return (
    active.reduce((sum, i) => sum + estimateRecallProbability(i, now), 0) /
    active.length
  );
}
