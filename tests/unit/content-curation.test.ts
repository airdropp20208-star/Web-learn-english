import { describe, it, expect } from "vitest";

import {
  countOccurrences,
  estimateUserLevel,
  getCEFRFrequency,
  pickTopWords,
  rankWordRelevance,
  suggestTexts,
  type CefrSpine,
} from "@/lib/content-curation";
import type { CEFRLevel, TextDTO } from "@/lib/types";

/**
 * Phần chấm điểm này quyết định người dùng thấy bài nào trước và học từ nào
 * trước. Sai ở đây không làm app sập, nó chỉ lặng lẽ gợi ý toàn thứ vô dụng —
 * kiểu lỗi khó phát hiện nhất, nên phải có test bám sát ý nghĩa từng quy tắc.
 */

function spine(rows: Array<[string, CEFRLevel, number | null]>): CefrSpine {
  return new Map(rows.map(([w, c, f]) => [w, { cefr: c, freq: f }]));
}

function bai(
  id: string,
  content: string,
  cefrLevel: CEFRLevel = "B1",
  createdAt = 1_000,
  title = id
): TextDTO {
  return {
    id,
    userId: "u",
    title,
    content,
    cefrLevel,
    createdAt,
    updatedAt: createdAt,
  };
}

const SPINE = spine([
  ["the", "A1", -3.0],
  ["cat", "A1", -4.5],
  ["important", "B1", -4.8],
  ["ubiquitous", "C1", -6.5],
  ["esoteric", "C2", -7.0],
]);

describe("getCEFRFrequency", () => {
  it("từ càng phổ biến điểm càng cao", () => {
    expect(getCEFRFrequency("the", SPINE)).toBe(10);
    expect(getCEFRFrequency("esoteric", SPINE)).toBe(1);
    expect(getCEFRFrequency("cat", SPINE)).toBeGreaterThan(
      getCEFRFrequency("ubiquitous", SPINE)
    );
  });

  it("không phân biệt hoa thường", () => {
    expect(getCEFRFrequency("The", SPINE)).toBe(getCEFRFrequency("the", SPINE));
  });

  it("từ ngoài trục nhận điểm mặc định 3", () => {
    expect(getCEFRFrequency("Zyzzyva", SPINE)).toBe(3);
  });

  it("từ có trong trục nhưng thiếu số liệu tần suất cũng nhận 3", () => {
    const s = spine([["foo", "B2", null]]);
    expect(getCEFRFrequency("foo", s)).toBe(3);
  });

  it("luôn nằm trong thang 1–10 kể cả khi tần suất vượt ngoài ngưỡng", () => {
    const s = spine([
      ["quá-phổ-biến", "A1", 0],
      ["quá-hiếm", "C2", -20],
    ]);
    expect(getCEFRFrequency("quá-phổ-biến", s)).toBe(10);
    expect(getCEFRFrequency("quá-hiếm", s)).toBe(1);
  });
});

describe("countOccurrences", () => {
  it("đếm qua nhiều bài, không phân biệt hoa thường", () => {
    const h = [bai("1", "The cat sat. A CAT ran."), bai("2", "No felines here.")];
    expect(countOccurrences("cat", h)).toBe(2);
  });

  it("chỉ khớp nguyên từ, không khớp một phần", () => {
    const h = [bai("1", "category catalogue cathedral")];
    expect(countOccurrences("cat", h)).toBe(0);
  });
});

describe("rankWordRelevance", () => {
  it("từ đã gặp trong lịch sử được cộng điểm so với từ chưa gặp", () => {
    const h = [bai("1", "ubiquitous ubiquitous ubiquitous")];
    const daGap = rankWordRelevance("ubiquitous", h, SPINE);
    const chuaGap = rankWordRelevance("esoteric", h, SPINE);
    expect(daGap).toBeGreaterThan(chuaGap);
  });

  it("lặp nhiều lần thắng được cả từ phổ thông chưa gặp bao giờ", () => {
    // Đây là điểm mấu chốt của công thức: từ chuyên ngành hiếm nhưng lặp lại
    // trong tài liệu người ta đang đọc thì đáng học hơn một từ phổ thông.
    const h = [bai("1", "esoteric esoteric esoteric esoteric esoteric")];
    expect(rankWordRelevance("esoteric", h, SPINE)).toBeGreaterThan(
      rankWordRelevance("the", [], SPINE)
    );
  });
});

describe("pickTopWords", () => {
  const noiDung = "The cat is important and ubiquitous and esoteric and zzzzunknown";

  it("bỏ từ đã có trong sổ từ", () => {
    const co = pickTopWords(noiDung, [], new Set(), SPINE, "A1", 99);
    const khong = pickTopWords(noiDung, [], new Set(["important"]), SPINE, "A1", 99);
    expect(co.map((w) => w.word)).toContain("important");
    expect(khong.map((w) => w.word)).not.toContain("important");
  });

  it("bỏ từ không có trong trục CEFR — tên riêng và lỗi chính tả", () => {
    const r = pickTopWords(noiDung, [], new Set(), SPINE, "A1", 99);
    expect(r.map((w) => w.word)).not.toContain("zzzzunknown");
  });

  it("bỏ từ thấp hơn trình độ người dùng quá một bậc", () => {
    // Người B2 không cần được nhắc "cat" (A1) — dưới sàn A2 nên bị loại.
    const r = pickTopWords(noiDung, [], new Set(), SPINE, "B2", 99);
    const words = r.map((w) => w.word);
    expect(words).not.toContain("cat");
    expect(words).toContain("ubiquitous");
  });

  it("giữ từ đúng một bậc dưới trình độ — sàn là mềm, không cắt sát", () => {
    const r = pickTopWords("important ubiquitous", [], new Set(), SPINE, "B2", 99);
    expect(r.map((w) => w.word)).toContain("important"); // B1, dưới B2 một bậc
  });

  it("bỏ token ngắn dưới 3 ký tự", () => {
    const s = spine([["is", "A1", -4]]);
    expect(pickTopWords("is is is", [], new Set(), s, "A1", 99)).toHaveLength(0);
  });

  it("cắt đúng topN và xếp giảm dần theo điểm", () => {
    const r = pickTopWords(noiDung, [], new Set(), SPINE, "A1", 2);
    expect(r).toHaveLength(2);
    expect(r[0].score).toBeGreaterThanOrEqual(r[1].score);
  });

  it("không trả trùng khi một từ xuất hiện nhiều lần", () => {
    const r = pickTopWords("cat cat cat", [], new Set(), SPINE, "A1", 99);
    expect(r).toHaveLength(1);
  });
});

describe("estimateUserLevel", () => {
  it("chưa đọc bài nào thì dùng mặc định", () => {
    expect(estimateUserLevel([])).toBe("A2");
    expect(estimateUserLevel([], "B1")).toBe("B1");
  });

  it("lấy trung vị nên một bài C2 đọc thử không kéo cả trình độ lên", () => {
    const h = [
      bai("1", "x", "A2", 1),
      bai("2", "x", "A2", 2),
      bai("3", "x", "C2", 3),
    ];
    expect(estimateUserLevel(h)).toBe("A2");
  });

  it("chỉ nhìn 10 bài gần nhất", () => {
    const cu = Array.from({ length: 12 }, (_, i) => bai(`cu${i}`, "x", "A1", i));
    const moi = Array.from({ length: 11 }, (_, i) => bai(`moi${i}`, "x", "C1", 100 + i));
    expect(estimateUserLevel([...cu, ...moi])).toBe("C1");
  });
});

describe("suggestTexts", () => {
  const ungVien = [
    { id: "a1", title: "Dễ", level: "A1" as CEFRLevel, content: "cat cat" },
    { id: "b1", title: "Vừa", level: "B1" as CEFRLevel, content: "important ubiquitous" },
    { id: "b2", title: "Trên một bậc", level: "B2" as CEFRLevel, content: "ubiquitous esoteric" },
    { id: "c2", title: "Quá khó", level: "C2" as CEFRLevel, content: "esoteric" },
  ];

  function goiY(userLevel: CEFRLevel, history: TextDTO[] = [], known = new Set<string>()) {
    return suggestTexts({
      candidates: ungVien,
      history,
      known,
      spine: SPINE,
      userLevel,
      limit: 10,
    });
  }

  it("ưu tiên bài trên trình độ một bậc", () => {
    const r = goiY("B1");
    expect(r[0].text.id).toBe("b2");
  });

  it("loại hẳn bài lệch quá xa trình độ", () => {
    const ids = goiY("B1").map((s) => s.text.id);
    expect(ids).not.toContain("c2"); // C2 cách B1 ba bậc
    expect(ids).not.toContain("a1"); // A1 cách B1 hai bậc về dưới
  });

  it("không gợi ý lại bài đã nhập vào thư viện cá nhân", () => {
    const daNhap = [bai("x", "…", "B2", 1, "Trên một bậc")];
    const ids = goiY("B1", daNhap).map((s) => s.text.id);
    expect(ids).not.toContain("b2");
  });

  it("so tiêu đề không phân biệt hoa thường và khoảng trắng thừa", () => {
    const daNhap = [bai("x", "…", "B2", 1, "  trên một bậc  ")];
    const ids = goiY("B1", daNhap).map((s) => s.text.id);
    expect(ids).not.toContain("b2");
  });

  it("đếm đúng số từ đáng học và ghi vào lý do", () => {
    const r = goiY("B1").find((s) => s.text.id === "b2")!;
    expect(r.newWords).toBe(2);
    expect(r.reason).toContain("2 từ đáng học");
  });

  it("nói rõ khi người dùng đã biết hết từ trong bài", () => {
    const r = goiY("B1", [], new Set(["ubiquitous", "esoteric"])).find(
      (s) => s.text.id === "b2"
    )!;
    expect(r.newWords).toBe(0);
    expect(r.reason).toContain("đã biết gần hết");
  });

  it("tôn trọng limit", () => {
    const r = suggestTexts({
      candidates: ungVien,
      history: [],
      known: new Set(),
      spine: SPINE,
      userLevel: "B1",
      limit: 1,
    });
    expect(r).toHaveLength(1);
  });

  it("thứ tự ổn định khi điểm bằng nhau", () => {
    const hai = [
      { id: "x", title: "Beta", level: "B2" as CEFRLevel, content: "ubiquitous" },
      { id: "y", title: "Alpha", level: "B2" as CEFRLevel, content: "ubiquitous" },
    ];
    const r = suggestTexts({
      candidates: hai,
      history: [],
      known: new Set(),
      spine: SPINE,
      userLevel: "B1",
      limit: 10,
    });
    expect(r.map((s) => s.text.title)).toEqual(["Alpha", "Beta"]);
  });
});
