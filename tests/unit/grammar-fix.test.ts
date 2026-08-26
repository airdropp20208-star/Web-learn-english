import { describe, it, expect } from "vitest";

import { apDungGoiY } from "@/components/grammar-check";
import type { GrammarCheckResponse } from "@/lib/types";

type Match = GrammarCheckResponse["matches"][number];

/**
 * Sửa một lỗi rồi sửa lỗi tiếp theo là thao tác bình thường nhất của tính năng
 * này — và cũng là chỗ dễ hỏng nhất. LanguageTool trả `offset` tính theo văn
 * bản lúc gửi đi; sửa xong một chỗ là mọi vị trí phía sau lệch đi. Không dời
 * lại thì lần bấm thứ hai cắt nhầm chỗ và người dùng chỉ thấy câu của mình bị
 * băm nát.
 */
function loi(offset: number, length: number, id = "R"): Match {
  return {
    message: "test",
    offset,
    length,
    rule: { id, description: "", category: { id: "TYPOS", name: "Typos" } },
    replacements: [],
  };
}

describe("apDungGoiY", () => {
  it("thay đúng đoạn được chỉ định, không đụng phần còn lại", () => {
    const text = "I has a cat.";
    const target = loi(2, 3); // "has"
    const r = apDungGoiY(text, [target], target, "have");
    expect(r.text).toBe("I have a cat.");
  });

  it("dời offset của lỗi phía sau khi bản sửa dài hơn", () => {
    const text = "I has a cat wich sleeps.";
    const a = loi(2, 3, "A"); // "has" -> "have", dài thêm 1
    const b = loi(12, 4, "B"); // "wich"
    const r = apDungGoiY(text, [a, b], a, "have");

    expect(r.text).toBe("I have a cat wich sleeps.");
    expect(r.matches).toHaveLength(1);
    // Lỗi còn lại phải trỏ đúng vào "wich" trong văn bản MỚI
    const con = r.matches[0];
    expect(r.text.slice(con.offset, con.offset + con.length)).toBe("wich");
  });

  it("dời offset khi bản sửa ngắn hơn", () => {
    const text = "This is is a test.";
    const a = loi(5, 5, "A"); // "is is" -> "is", ngắn đi 3
    const b = loi(13, 4, "B"); // "test"
    const r = apDungGoiY(text, [a, b], a, "is");

    expect(r.text).toBe("This is a test.");
    const con = r.matches[0];
    expect(r.text.slice(con.offset, con.offset + con.length)).toBe("test");
  });

  it("giữ nguyên offset của lỗi nằm trước chỗ vừa sửa", () => {
    const text = "teh cat is is here.";
    const truoc = loi(0, 3, "A"); // "teh"
    const sau = loi(8, 5, "B"); // "is is"
    const r = apDungGoiY(text, [truoc, sau], sau, "is");

    expect(r.text).toBe("teh cat is here.");
    const con = r.matches[0];
    expect(con.offset).toBe(0);
    expect(r.text.slice(con.offset, con.offset + con.length)).toBe("teh");
  });

  it("bỏ lỗi chồng lấn lên đoạn vừa sửa thay vì để lại gợi ý trỏ vào chỗ đã đổi", () => {
    const text = "I has a cat.";
    const a = loi(2, 3, "A"); // "has"
    const chongLan = loi(3, 3, "B"); // "as " — nằm đè lên "has"
    const r = apDungGoiY(text, [a, chongLan], a, "have");

    expect(r.matches).toHaveLength(0);
  });

  it("chuỗi nhiều lần sửa liên tiếp vẫn ra văn bản đúng", () => {
    let text = "I has a cat wich dont sleep.";
    let matches = [
      loi(2, 3, "A"), // has
      loi(12, 4, "B"), // wich
      loi(17, 4, "C"), // dont
    ];

    for (const thay of ["have", "which", "does not"]) {
      const target = matches[0];
      const r = apDungGoiY(text, matches, target, thay);
      text = r.text;
      matches = r.matches;
    }

    expect(text).toBe("I have a cat which does not sleep.");
    expect(matches).toHaveLength(0);
  });

  it("bản sửa rỗng nghĩa là xoá đoạn đó đi", () => {
    const text = "This is is a test.";
    const a = loi(7, 3); // " is"
    const r = apDungGoiY(text, [a], a, "");
    expect(r.text).toBe("This is a test.");
  });

  it("không làm biến đổi mảng đầu vào", () => {
    const a = loi(2, 3, "A");
    const b = loi(12, 4, "B");
    const goc = [a, b];
    apDungGoiY("I has a cat wich sleeps.", goc, a, "have");

    expect(goc).toHaveLength(2);
    expect(b.offset).toBe(12);
  });
});
