import { describe, it, expect } from "vitest";

import { taoCauDienTu } from "@/components/tabs/review-tab";

/**
 * Bản trước khoét từ bằng `new RegExp(word, "i")`. Với từ vựng bình thường
 * thì chạy, nhưng bộ từ có cả "(to) run" và "e.g." — dấu ngoặc làm regex ném
 * lỗi và cả buổi ôn sập, dấu chấm khớp nhầm ký tự bất kỳ nên khoét sai chỗ.
 * Test ở đây bám đúng những trường hợp đó.
 */
describe("taoCauDienTu", () => {
  it("khoét đúng từ trong câu", () => {
    expect(taoCauDienTu("The cat sat on the mat.", "cat")).toBe(
      "The _____ sat on the mat."
    );
  });

  it("không phân biệt hoa thường nhưng giữ nguyên phần còn lại", () => {
    expect(taoCauDienTu("Cat is a noun.", "cat")).toBe("_____ is a noun.");
  });

  it("chỉ khoét lần xuất hiện đầu tiên", () => {
    expect(taoCauDienTu("cat and cat", "cat")).toBe("_____ and cat");
  });

  it("từ chứa dấu ngoặc không làm vỡ hàm", () => {
    // Đây là ca làm bản regex ném "Unterminated group" và sập cả tab.
    expect(() => taoCauDienTu("You should (to) run daily.", "(to) run")).not.toThrow();
    expect(taoCauDienTu("You should (to) run daily.", "(to) run")).toBe(
      "You should _____ daily."
    );
  });

  it("dấu chấm trong từ không khớp bừa ký tự khác", () => {
    // Regex `/e.g./i` sẽ khớp "eag" trong "eagle" — sai hoàn toàn.
    expect(taoCauDienTu("An eagle flew by.", "e.g.")).toBe("An eagle flew by.");
    expect(taoCauDienTu("Fruits, e.g. apples.", "e.g.")).toBe("Fruits, _____ apples.");
  });

  it("từ không có trong câu thì trả nguyên câu", () => {
    expect(taoCauDienTu("The cat sat.", "dog")).toBe("The cat sat.");
  });

  it("câu rỗng không làm gì cả", () => {
    expect(taoCauDienTu("", "cat")).toBe("");
  });
});
