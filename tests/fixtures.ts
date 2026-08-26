// Fixtures dùng chung cho test. Giữ tối giản: chỉ đủ trường để logic chạy.
import type { MemoryItemDTO, FSRSCardState, CEFRLevel } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function makeCardState(
  overrides: Partial<FSRSCardState> = {}
): FSRSCardState {
  return {
    due: new Date(Date.now() + DAY_MS).toISOString(),
    stability: 1,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 1,
    learning_steps: 0,
    reps: 1,
    lapses: 0,
    state: 2,
    last_review: new Date().toISOString(),
    ...overrides,
  };
}

/** Thẻ mới tinh — chưa ôn lần nào, luôn tới hạn. */
export function makeNewCardState(): FSRSCardState {
  return makeCardState({
    reps: 0,
    state: 0,
    last_review: null,
    due: new Date().toISOString(),
  });
}

/** Thẻ đã quá hạn `daysOverdue` ngày. */
export function makeDueCardState(daysOverdue = 1): FSRSCardState {
  return makeCardState({
    due: new Date(Date.now() - daysOverdue * DAY_MS).toISOString(),
    last_review: new Date(Date.now() - (daysOverdue + 1) * DAY_MS).toISOString(),
  });
}

export function makeMemoryItem(
  overrides: Partial<MemoryItemDTO> = {}
): MemoryItemDTO {
  const id = overrides.id ?? `item-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    userId: "local-user",
    sourceTextId: "text-1",
    itemType: "word",
    refText: "example",
    cefrLevel: "B1" as CEFRLevel,
    card: makeCardState(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}
