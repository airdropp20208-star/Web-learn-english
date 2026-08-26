import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CEFR_ORDER,
  isCardDue,
  estimateRecallProbability,
  nextTier,
} from "@/lib/mastery-engine";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-15T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("CEFR_ORDER", () => {
  it("đủ 6 bậc theo đúng thứ tự", () => {
    expect(CEFR_ORDER).toEqual(["A1", "A2", "B1", "B2", "C1", "C2"]);
  });
});

describe("isCardDue", () => {
  it("thẻ chưa ôn lần nào luôn tới hạn", () => {
    const future = new Date(NOW.getTime() + 30 * DAY).toISOString();
    expect(isCardDue({ due: future, reps: 0 })).toBe(true);
  });

  it("thẻ có hạn trong quá khứ là tới hạn", () => {
    const past = new Date(NOW.getTime() - DAY).toISOString();
    expect(isCardDue({ due: past, reps: 3 })).toBe(true);
  });

  it("thẻ có hạn trong tương lai chưa tới hạn", () => {
    const future = new Date(NOW.getTime() + DAY).toISOString();
    expect(isCardDue({ due: future, reps: 3 })).toBe(false);
  });

  it("thẻ đúng hạn ngay lúc này là tới hạn", () => {
    expect(isCardDue({ due: NOW.toISOString(), reps: 3 })).toBe(true);
  });
});

describe("estimateRecallProbability", () => {
  it("vừa ôn xong thì xác suất nhớ ≈ 1", () => {
    const p = estimateRecallProbability({
      stability: 10,
      lastReview: NOW.toISOString(),
    });
    expect(p).toBeCloseTo(1, 5);
  });

  it("trôi qua đúng bằng stability thì xác suất ≈ e⁻¹", () => {
    const p = estimateRecallProbability({
      stability: 10,
      lastReview: new Date(NOW.getTime() - 10 * DAY).toISOString(),
    });
    expect(p).toBeCloseTo(Math.exp(-1), 4);
  });

  it("càng để lâu càng quên", () => {
    const gan = estimateRecallProbability({
      stability: 5,
      lastReview: new Date(NOW.getTime() - DAY).toISOString(),
    });
    const xa = estimateRecallProbability({
      stability: 5,
      lastReview: new Date(NOW.getTime() - 20 * DAY).toISOString(),
    });
    expect(xa).toBeLessThan(gan);
  });

  it("stability = 0 không gây chia cho 0", () => {
    const p = estimateRecallProbability({
      stability: 0,
      lastReview: new Date(NOW.getTime() - DAY).toISOString(),
    });
    expect(Number.isFinite(p)).toBe(true);
    expect(p).toBeGreaterThanOrEqual(0);
  });

  it("lastReview ở tương lai không cho xác suất > 1", () => {
    const p = estimateRecallProbability({
      stability: 10,
      lastReview: new Date(NOW.getTime() + 5 * DAY).toISOString(),
    });
    expect(p).toBeLessThanOrEqual(1);
  });
});

describe("nextTier", () => {
  it.each([
    ["A1", "A2"],
    ["A2", "B1"],
    ["B1", "B2"],
    ["B2", "C1"],
    ["C1", "C2"],
  ] as const)("%s → %s", (from, to) => {
    expect(nextTier(from)).toBe(to);
  });

  it("C2 là bậc cuối, không có bậc kế", () => {
    expect(nextTier("C2")).toBeNull();
  });
});
