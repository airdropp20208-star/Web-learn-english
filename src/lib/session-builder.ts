// Session Builder — picks due items + interleaves for variety

import type { MemoryItemDTO, QuizType } from "./types";
import { estimateRecallProbability } from "./mastery-engine";

export interface ReviewSessionItem {
  item: MemoryItemDTO;
  recallProb: number;
  chosenFormat: QuizType;
}

/**
 * Build a review session: filter due items, sort by urgency, cap size, interleave.
 */
export function buildReviewSession(
  allItems: MemoryItemDTO[],
  maxSize: number = 18,
  now: number = Date.now()
): ReviewSessionItem[] {
  const due = allItems
    .map((item) => ({
      item,
      recallProb: estimateRecallProbability(item, now),
    }))
    .filter((x) => x.recallProb < 0.85) // REVIEW_THRESHOLD
    .sort((a, b) => a.recallProb - b.recallProb) // urgent first
    .slice(0, maxSize);

  return interleave(due);
}

/**
 * Interleave: no two consecutive items share sourceTextId.
 * For each item, random pick a quiz format (mcq / cloze / recall).
 */
function interleave<T extends { item: MemoryItemDTO }>(
  dueItems: T[]
): Array<T & { chosenFormat: QuizType }> {
  if (dueItems.length === 0) return [];

  const formats: QuizType[] = ["mcq", "cloze", "recall"];
  const result: Array<T & { chosenFormat: QuizType }> = [];
  const remaining = [...dueItems];
  let lastTextId: string | null = null;

  while (remaining.length > 0) {
    // Find first item with different sourceTextId
    let nextIdx = remaining.findIndex((x) => x.item.sourceTextId !== lastTextId);
    if (nextIdx === -1) nextIdx = 0; // fallback if all same

    const next = remaining.splice(nextIdx, 1)[0];
    const chosenFormat = formats[Math.floor(Math.random() * formats.length)];
    result.push({ ...next, chosenFormat });
    lastTextId = next.item.sourceTextId;
  }

  return result;
}
