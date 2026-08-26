import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  meaningOf,
  shuffle,
  pickWords,
  buildQuestion,
  buildQuestions,
  recordAnswer,
  comboMultiplier,
  isTypedAnswerCorrect,
  type GameWord,
  type QuestionKind,
} from "@/lib/game-engine";
import { getDeckSubscription } from "@/lib/deck-storage";
import type { FSRSCardState } from "@/lib/types";
import { makeCardState, makeNewCardState, makeDueCardState } from "../fixtures";

const NOW = new Date("2026-06-15T12:00:00.000Z");

/** Bộ từ đủ lớn để dựng được mọi kiểu câu hỏi (cần ≥ 4 nghĩa khác nhau). */
function makeWords(count: number): GameWord[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    word: `word${i}`,
    vietnamese: `nghĩa ${i}`,
    definition: `definition ${i}`,
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("meaningOf", () => {
  it("ưu tiên nghĩa tiếng Việt", () => {
    expect(
      meaningOf({ index: 0, word: "cat", vietnamese: "con mèo", definition: "a feline" })
    ).toBe("con mèo");
  });

  it("thiếu tiếng Việt thì lấy definition", () => {
    expect(meaningOf({ index: 0, word: "cat", definition: "a feline" })).toBe("a feline");
  });

  it("chuỗi toàn khoảng trắng coi như không có", () => {
    expect(meaningOf({ index: 0, word: "cat", vietnamese: "   ", definition: "a feline" })).toBe(
      "a feline"
    );
  });

  it("không có nghĩa nào thì trả null", () => {
    expect(meaningOf({ index: 0, word: "cat" })).toBeNull();
    expect(meaningOf({ index: 0, word: "cat", vietnamese: "", definition: "  " })).toBeNull();
  });
});

describe("shuffle", () => {
  it("không sửa mảng gốc", () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    shuffle(original);
    expect(original).toEqual(copy);
  });

  it("giữ nguyên số lượng và thành phần", () => {
    const input = ["a", "b", "c", "d"];
    const out = shuffle(input);
    expect(out).toHaveLength(4);
    expect([...out].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("mảng rỗng và 1 phần tử không lỗi", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([7])).toEqual([7]);
  });
});

describe("isTypedAnswerCorrect", () => {
  it.each([
    ["cat", "cat", true],
    ["CAT", "cat", true],
    ["  cat  ", "cat", true],
    ["Cat", "  CAT ", true],
    ["cats", "cat", false],
    ["", "cat", false],
    ["ca t", "cat", false],
  ])("'%s' vs '%s' → %s", (input, answer, expected) => {
    expect(isTypedAnswerCorrect(input, answer)).toBe(expected);
  });
});

describe("comboMultiplier", () => {
  it.each([
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1.5],
    [4, 1.5],
    [5, 2],
    [9, 2],
    [10, 3],
    [100, 3],
  ])("combo %d → x%s", (combo, expected) => {
    expect(comboMultiplier(combo)).toBe(expected);
  });

  it("không bao giờ giảm khi combo tăng", () => {
    let prev = 0;
    for (let c = 0; c <= 20; c++) {
      const m = comboMultiplier(c);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });
});

describe("pickWords", () => {
  it("không trả quá số lượng yêu cầu", () => {
    expect(pickWords(makeWords(20), {}, 5)).toHaveLength(5);
  });

  it("ít từ hơn yêu cầu thì trả hết những gì có", () => {
    expect(pickWords(makeWords(3), {}, 10)).toHaveLength(3);
  });

  it("ưu tiên từ đến hạn trước từ chưa học", () => {
    const words = makeWords(6);
    const states: Record<string, FSRSCardState> = {
      word4: makeDueCardState(3),
      word5: makeDueCardState(1),
    };
    const picked = pickWords(words, states, 2).map((w) => w.word).sort();
    expect(picked).toEqual(["word4", "word5"]);
  });

  it("ưu tiên từ chưa học trước từ chưa tới hạn", () => {
    const words = makeWords(4);
    const future = makeCardState({
      due: new Date(NOW.getTime() + 30 * 86400000).toISOString(),
      reps: 5,
    });
    const states: Record<string, FSRSCardState> = {
      word0: future,
      word1: future,
      word2: future,
    };
    // Chỉ word3 là chưa học → phải được chọn đầu tiên
    expect(pickWords(words, states, 1)[0].word).toBe("word3");
  });

  it("thẻ reps = 0 tính là đến hạn", () => {
    const words = makeWords(4);
    const states: Record<string, FSRSCardState> = { word2: makeNewCardState() };
    expect(pickWords(words, states, 4).map((w) => w.word)).toContain("word2");
  });

  it("bộ từ rỗng trả mảng rỗng", () => {
    expect(pickWords([], {}, 5)).toEqual([]);
  });
});

describe("buildQuestion", () => {
  const words = makeWords(10);
  const target = words[0];

  it("spell: đề là nghĩa, đáp án là từ, không có lựa chọn", () => {
    const q = buildQuestion(target, words, "spell");
    expect(q).not.toBeNull();
    expect(q?.prompt).toBe("nghĩa 0");
    expect(q?.answer).toBe("word0");
    expect(q?.options).toEqual([]);
  });

  it("listen: 4 lựa chọn, đề rỗng, đáp án nằm trong lựa chọn", () => {
    const q = buildQuestion(target, words, "listen");
    expect(q?.options).toHaveLength(4);
    expect(q?.prompt).toBe("");
    expect(q?.options).toContain("word0");
  });

  it("meaning-to-word: đề là nghĩa, 4 lựa chọn là các từ", () => {
    const q = buildQuestion(target, words, "meaning-to-word");
    expect(q?.prompt).toBe("nghĩa 0");
    expect(q?.answer).toBe("word0");
    expect(q?.options).toHaveLength(4);
    expect(q?.options).toContain("word0");
  });

  it("word-to-meaning: đề là từ, 4 lựa chọn là các nghĩa", () => {
    const q = buildQuestion(target, words, "word-to-meaning");
    expect(q?.prompt).toBe("word0");
    expect(q?.answer).toBe("nghĩa 0");
    expect(q?.options).toHaveLength(4);
    expect(q?.options).toContain("nghĩa 0");
  });

  it("không lựa chọn nào trùng nhau", () => {
    for (const kind of ["listen", "meaning-to-word", "word-to-meaning"] as QuestionKind[]) {
      const q = buildQuestion(target, words, kind);
      expect(new Set(q?.options).size).toBe(q?.options.length);
    }
  });

  it("target không bao giờ là mồi nhử của chính nó", () => {
    const q = buildQuestion(target, words, "meaning-to-word");
    expect(q?.options.filter((o) => o === "word0")).toHaveLength(1);
  });

  it("thiếu nghĩa thì spell và word-to-meaning không dựng được", () => {
    const bare: GameWord = { index: 99, word: "bare" };
    const pool = [bare, ...words];
    expect(buildQuestion(bare, pool, "spell")).toBeNull();
    expect(buildQuestion(bare, pool, "word-to-meaning")).toBeNull();
    expect(buildQuestion(bare, pool, "meaning-to-word")).toBeNull();
  });

  it("thiếu nghĩa vẫn dựng được câu nghe", () => {
    const bare: GameWord = { index: 99, word: "bare" };
    expect(buildQuestion(bare, [bare, ...words], "listen")).not.toBeNull();
  });

  it("không đủ 3 mồi nhử thì trả null", () => {
    const tiny = makeWords(2);
    expect(buildQuestion(tiny[0], tiny, "listen")).toBeNull();
    expect(buildQuestion(tiny[0], tiny, "meaning-to-word")).toBeNull();
    expect(buildQuestion(tiny[0], tiny, "word-to-meaning")).toBeNull();
  });

  it("các từ trùng nghĩa nhau không dựng được word-to-meaning", () => {
    const same: GameWord[] = Array.from({ length: 6 }, (_, i) => ({
      index: i,
      word: `w${i}`,
      vietnamese: "cùng một nghĩa",
    }));
    expect(buildQuestion(same[0], same, "word-to-meaning")).toBeNull();
  });
});

describe("buildQuestions", () => {
  it("sinh đúng số câu khi dữ liệu đủ", () => {
    expect(buildQuestions(makeWords(20), {}, 8)).toHaveLength(8);
  });

  it("mọi câu hỏi có id duy nhất", () => {
    const qs = buildQuestions(makeWords(20), {}, 10);
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
  });

  it("chỉ dùng những kiểu câu hỏi được cho phép", () => {
    const qs = buildQuestions(makeWords(20), {}, 10, ["spell"]);
    expect(qs.every((q) => q.kind === "spell")).toBe(true);
  });

  it("bỏ qua từ không dựng nổi câu hỏi thay vì ném lỗi", () => {
    const words: GameWord[] = [
      ...makeWords(5),
      { index: 5, word: "bare1" },
      { index: 6, word: "bare2" },
    ];
    const qs = buildQuestions(words, {}, 7, ["spell"]);
    expect(qs.length).toBe(5);
    expect(qs.map((q) => q.target.word)).not.toContain("bare1");
  });

  it("bộ từ rỗng trả mảng rỗng", () => {
    expect(buildQuestions([], {}, 5)).toEqual([]);
  });
});

describe("recordAnswer", () => {
  beforeEach(() => localStorage.clear());

  it("trả lời đúng ghi được state mới và tăng reps", async () => {
    const word = makeWords(1)[0];
    const next = await recordAnswer("deck-a", word, true);
    expect(next.reps).toBe(1);
  });

  it("lưu tiến độ vào deck", async () => {
    const word = makeWords(1)[0];
    await recordAnswer("deck-a", word, true);
    const sub = await getDeckSubscription("deck-a");
    expect(sub?.studiedWords).toContain(0);
    expect(sub?.cardStates["word0"]).toBeDefined();
  });

  it("trả lời sai xếp lịch ôn sớm hơn trả lời đúng", async () => {
    const word = makeWords(1)[0];
    const wrong = await recordAnswer("deck-a", word, false);
    const right = await recordAnswer("deck-b", word, true);
    expect(new Date(wrong.due).getTime()).toBeLessThan(new Date(right.due).getTime());
  });

  it("tiếp nối được state cũ thay vì làm lại từ đầu", async () => {
    const word = makeWords(1)[0];
    const first = await recordAnswer("deck-a", word, true);
    const second = await recordAnswer("deck-a", word, true, first);
    expect(second.reps).toBe(2);
  });
});
