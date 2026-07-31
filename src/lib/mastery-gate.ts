// Mastery Gate — check tier advancement using FSRS retention estimate

import type { MemoryItemDTO, CEFRLevel } from "./types";
import { CEFR_ORDER, TIER_THRESHOLD, MIN_SAMPLE_SIZE } from "./mastery-engine";
import { estimateRecallProbability } from "./mastery-engine";

/**
 * Check if user is ready to advance to next CEFR tier.
 */
export function checkTierAdvancement(
  items: MemoryItemDTO[],
  currentTier: CEFRLevel,
  now: number = Date.now()
): { canAdvance: boolean; nextTier: CEFRLevel | null; avgP: number; sampleSize: number } {
  const nextTierIdx = CEFR_ORDER.indexOf(currentTier) + 1;
  const nextTier: CEFRLevel | null =
    nextTierIdx < CEFR_ORDER.length ? CEFR_ORDER[nextTierIdx] : null;

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
    active.reduce((sum, i) => {
      // For FSRS cards, estimate retention from stability + time since last review
      if (i.card.last_review) {
        return sum + estimateRecallProbability({
          stability: i.card.stability,
          lastReview: i.card.last_review,
        });
      }
      // New cards (never reviewed) have 0 retention
      return sum;
    }, 0) / active.length;

  return {
    canAdvance: avgP >= TIER_THRESHOLD && nextTier !== null,
    nextTier,
    avgP,
    sampleSize: active.length,
  };
}

/**
 * Compute current tier mastery score.
 */
export function computeTierMasteryScore(
  items: MemoryItemDTO[],
  currentTier: CEFRLevel,
  now: number = Date.now()
): number {
  const active = items.filter((i) => i.cefrLevel === currentTier);
  if (active.length === 0) return 0;
  return (
    active.reduce((sum, i) => {
      if (i.card.last_review) {
        return sum + estimateRecallProbability({
          stability: i.card.stability,
          lastReview: i.card.last_review,
        });
      }
      return sum;
    }, 0) / active.length
  );
}
