// Session Builder — uses FSRS card state (due date) instead of half-life

import type { MemoryItemDTO, QuizType } from "./types";

export interface ReviewSessionItem {
  item: MemoryItemDTO;
  chosenFormat: QuizType;
}

/**
 * Build a review session: filter due cards, sort by due date (oldest first).
 * FSRS cards have a `due` field — if due <= now, it's due for review.
 */
export function buildReviewSession(
  allItems: MemoryItemDTO[],
  maxSize: number = 18
): ReviewSessionItem[] {
  const now = Date.now();

  const due = allItems
    .filter((item) => {
      // New cards (reps=0) are always due
      if (item.card.reps === 0) return true;
      // Review cards: due if due date <= now
      return new Date(item.card.due).getTime() <= now;
    })
    .sort((a, b) => {
      // Sort: new cards first (reps=0), then by due date ascending
      if (a.card.reps === 0 && b.card.reps !== 0) return -1;
      if (a.card.reps !== 0 && b.card.reps === 0) return 1;
      return new Date(a.card.due).getTime() - new Date(b.card.due).getTime();
    })
    .slice(0, maxSize);

  // interleave làm việc trên phần tử phiên ôn ({ item }), không phải trên
  // MemoryItemDTO trần — thiếu bước bọc này thì x.item là undefined và cả
  // tính năng Ôn tập ném TypeError ngay khi có một thẻ tới hạn.
  return interleave(due.map((item) => ({ item })));
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
    let nextIdx = remaining.findIndex((x) => x.item.sourceTextId !== lastTextId);
    if (nextIdx === -1) nextIdx = 0;

    const next = remaining.splice(nextIdx, 1)[0];
    const chosenFormat = formats[Math.floor(Math.random() * formats.length)];
    result.push({ ...next, chosenFormat });
    lastTextId = next.item.sourceTextId;
  }

  return result;
}
