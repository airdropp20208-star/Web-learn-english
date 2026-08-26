import { describe, it, expect } from "vitest";
import { buildReviewSession } from "@/lib/session-builder";
import { makeMemoryItem, makeNewCardState, makeDueCardState, makeCardState } from "../fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("buildReviewSession", () => {
  it("trả mảng rỗng khi không có thẻ nào", () => {
    expect(buildReviewSession([])).toEqual([]);
  });

  it("trả mảng rỗng khi không thẻ nào tới hạn", () => {
    const notDue = makeMemoryItem({
      card: makeCardState({ due: new Date(Date.now() + 7 * DAY_MS).toISOString() }),
    });
    expect(buildReviewSession([notDue])).toEqual([]);
  });

  // BUG: interleave() đọc x.item.sourceTextId nhưng nhận thẳng MemoryItemDTO[],
  // nên x.item là undefined → TypeError. Test này ĐỎ trước khi sửa.
  it("không được ném lỗi khi có thẻ tới hạn", () => {
    const due = makeMemoryItem({ card: makeDueCardState(2) });
    expect(() => buildReviewSession([due])).not.toThrow();
  });

  it("mỗi phần tử trả về phải có .item và .chosenFormat", () => {
    const due = makeMemoryItem({ id: "due-1", card: makeDueCardState(2) });
    const session = buildReviewSession([due]);

    expect(session).toHaveLength(1);
    expect(session[0].item).toBeDefined();
    expect(session[0].item.id).toBe("due-1");
    expect(["mcq", "cloze", "recall"]).toContain(session[0].chosenFormat);
  });

  it("thẻ mới (reps=0) luôn được coi là tới hạn", () => {
    const fresh = makeMemoryItem({ id: "new-1", card: makeNewCardState() });
    const session = buildReviewSession([fresh]);
    expect(session.map((s) => s.item.id)).toEqual(["new-1"]);
  });

  it("xếp thẻ mới lên trước thẻ đã ôn", () => {
    const reviewed = makeMemoryItem({ id: "reviewed", card: makeDueCardState(5) });
    const fresh = makeMemoryItem({ id: "fresh", card: makeNewCardState() });

    const ids = buildReviewSession([reviewed, fresh]).map((s) => s.item.id);
    expect(ids[0]).toBe("fresh");
  });

  it("tôn trọng maxSize", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      makeMemoryItem({ id: `i-${i}`, card: makeDueCardState(1) })
    );
    expect(buildReviewSession(items, 18)).toHaveLength(18);
  });

  it("mặc định maxSize là 18", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      makeMemoryItem({ id: `i-${i}`, card: makeDueCardState(1) })
    );
    expect(buildReviewSession(items)).toHaveLength(18);
  });

  it("xen kẽ để hai thẻ liền nhau không cùng nguồn, khi dữ liệu cho phép", () => {
    const items = [
      makeMemoryItem({ id: "a1", sourceTextId: "A", card: makeDueCardState(1) }),
      makeMemoryItem({ id: "a2", sourceTextId: "A", card: makeDueCardState(1) }),
      makeMemoryItem({ id: "b1", sourceTextId: "B", card: makeDueCardState(1) }),
      makeMemoryItem({ id: "b2", sourceTextId: "B", card: makeDueCardState(1) }),
    ];

    const sources = buildReviewSession(items).map((s) => s.item.sourceTextId);
    for (let i = 1; i < sources.length; i++) {
      expect(sources[i]).not.toBe(sources[i - 1]);
    }
  });

  it("không làm mất thẻ nào khi số lượng dưới maxSize", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeMemoryItem({ id: `k-${i}`, card: makeDueCardState(1) })
    );
    const ids = buildReviewSession(items).map((s) => s.item.id).sort();
    expect(ids).toEqual(["k-0", "k-1", "k-2", "k-3", "k-4"]);
  });
});
