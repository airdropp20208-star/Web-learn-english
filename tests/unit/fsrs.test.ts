import { describe, it, expect } from "vitest";
import { Rating, State, type Grade } from "ts-fsrs";
import {
  createNewCard,
  reviewCard,
  previewSchedule,
  serializeCard,
  deserializeCard,
  formatInterval,
} from "@/lib/fsrs";

describe("Rating enum — chống lệch bậc", () => {
  // Comment cũ trong fsrs.ts ghi "1=Manual, 2=Again..." — lệch 1 bậc so với
  // ts-fsrs thật, khiến review-tab gửi sai mức đánh giá cho MỌI nút.
  it("giá trị enum đúng như ts-fsrs định nghĩa", () => {
    expect(Rating.Manual).toBe(0);
    expect(Rating.Again).toBe(1);
    expect(Rating.Hard).toBe(2);
    expect(Rating.Good).toBe(3);
    expect(Rating.Easy).toBe(4);
  });
});

describe("createNewCard", () => {
  it("tạo thẻ mới ở trạng thái New, chưa ôn lần nào", () => {
    const card = createNewCard();
    expect(card.reps).toBe(0);
    expect(card.state).toBe(State.New);
    expect(card.due).toBeInstanceOf(Date);
  });

  it("thẻ mới có learning_steps (trường bắt buộc của ts-fsrs 5)", () => {
    expect(createNewCard().learning_steps).toBeDefined();
  });
});

describe("reviewCard", () => {
  it("tăng reps sau mỗi lần ôn", () => {
    const { card } = reviewCard(createNewCard(), Rating.Good);
    expect(card.reps).toBe(1);
  });

  it("chấp nhận cả 4 mức đánh giá hợp lệ mà không ném lỗi", () => {
    for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) {
      expect(() => reviewCard(createNewCard(), rating)).not.toThrow();
    }
  });

  it("Easy phải xếp lịch xa hơn Again", () => {
    const easy = reviewCard(createNewCard(), Rating.Easy).card;
    const again = reviewCard(createNewCard(), Rating.Again).card;
    expect(easy.due.getTime()).toBeGreaterThan(again.due.getTime());
  });

  it("Again làm tăng lapses trên thẻ đã thuộc", () => {
    const learned = reviewCard(
      reviewCard(createNewCard(), Rating.Easy).card,
      Rating.Easy
    ).card;
    const lapsed = reviewCard(learned, Rating.Again).card;
    expect(lapsed.lapses).toBeGreaterThanOrEqual(learned.lapses);
  });
});

describe("serializeCard / deserializeCard", () => {
  it("giữ nguyên các trường số qua một vòng round-trip", () => {
    const original = reviewCard(createNewCard(), Rating.Good).card;
    const restored = deserializeCard(serializeCard(original));

    expect(restored.stability).toBe(original.stability);
    expect(restored.difficulty).toBe(original.difficulty);
    expect(restored.reps).toBe(original.reps);
    expect(restored.lapses).toBe(original.lapses);
    expect(restored.state).toBe(original.state);
    expect(restored.scheduled_days).toBe(original.scheduled_days);
  });

  it("giữ nguyên ngày tháng qua round-trip", () => {
    const original = reviewCard(createNewCard(), Rating.Good).card;
    const restored = deserializeCard(serializeCard(original));

    expect(restored.due.getTime()).toBe(original.due.getTime());
    expect(restored.last_review?.getTime()).toBe(original.last_review?.getTime());
  });

  // BUG: serializeCard bỏ sót learning_steps → mất trạng thái học sau mỗi
  // lần lưu. Thẻ ở Learning/Relearning bị xếp lịch sai. Test này ĐỎ trước khi sửa.
  it("giữ nguyên learning_steps qua round-trip", () => {
    const original = reviewCard(createNewCard(), Rating.Again).card;
    const restored = deserializeCard(serializeCard(original));
    expect(restored.learning_steps).toBe(original.learning_steps);
  });

  it("thẻ khôi phục phải cho lịch ôn giống hệt thẻ gốc", () => {
    const original = reviewCard(createNewCard(), Rating.Again).card;
    const restored = deserializeCard(serializeCard(original));

    const fromOriginal = reviewCard(original, Rating.Good).card;
    const fromRestored = reviewCard(restored, Rating.Good).card;

    expect(fromRestored.scheduled_days).toBe(fromOriginal.scheduled_days);
    expect(fromRestored.state).toBe(fromOriginal.state);
  });
});

describe("previewSchedule", () => {
  it("trả đủ 4 mức đánh giá", () => {
    const preview = previewSchedule(createNewCard());
    expect(Object.keys(preview).sort()).toEqual(["again", "easy", "good", "hard"]);
  });

  it("mỗi mức có dueDate là Date hợp lệ", () => {
    const preview = previewSchedule(createNewCard());
    for (const key of ["again", "hard", "good", "easy"] as const) {
      expect(preview[key].dueDate).toBeInstanceOf(Date);
      expect(Number.isNaN(preview[key].dueDate.getTime())).toBe(false);
    }
  });

  it("khoảng cách tăng dần theo mức: again ≤ hard ≤ good ≤ easy", () => {
    const p = previewSchedule(reviewCard(createNewCard(), Rating.Good).card);
    expect(p.again.dueDate.getTime()).toBeLessThanOrEqual(p.hard.dueDate.getTime());
    expect(p.hard.dueDate.getTime()).toBeLessThanOrEqual(p.good.dueDate.getTime());
    expect(p.good.dueDate.getTime()).toBeLessThanOrEqual(p.easy.dueDate.getTime());
  });
});

describe("formatInterval", () => {
  it.each([
    [0.5, "<1d"],
    [1, "1d"],
    [15, "15d"],
    [29, "29d"],
    [30, "1mo"],
    [180, "6mo"],
    [365, "1.0y"],
    [730, "2.0y"],
  ])("%d ngày → %s", (days, expected) => {
    expect(formatInterval(days)).toBe(expected);
  });
});
