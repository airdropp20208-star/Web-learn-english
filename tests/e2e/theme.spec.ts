import { test, expect } from "@playwright/test";

/**
 * Chế độ tối trước đây tồn tại trên giấy: `next-themes` đã cài, token màu
 * `.dark` đã có, nhưng không nút nào bật được nó nên chưa ai từng thấy nó
 * chạy. Test này giữ cho cái nút đó còn sống.
 */

test.describe("Giao diện sáng/tối", () => {
  test("chọn Tối thì đổi ngay và nhớ qua lần tải lại", async ({ page }) => {
    await page.goto("/?app=1");

    await page.getByRole("button", { name: "Tài khoản" }).click();
    await page.getByRole("menuitemradio", { name: "Tối" }).click();

    const goc = page.locator("html");
    await expect(goc).toHaveClass(/dark/);

    // next-themes ghi lựa chọn vào localStorage; tải lại phải giữ nguyên,
    // không được nháy về sáng rồi mới đổi.
    await page.reload();
    await expect(goc).toHaveClass(/dark/);
  });

  test("nền và chữ vẫn tương phản khi ở chế độ tối", async ({ page }) => {
    await page.goto("/?app=1");
    await page.getByRole("button", { name: "Tài khoản" }).click();
    await page.getByRole("menuitemradio", { name: "Tối" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.keyboard.press("Escape");

    // Tailwind 4 khai màu trong không gian oklch, nên getComputedStyle trả về
    // `lab(...)` chứ không phải `rgb(...)`. Cho canvas tô thử rồi đọc lại pixel:
    // trình duyệt tự quy về sRGB, khỏi phải tự viết bộ chuyển không gian màu.
    const mau = await page.evaluate(() => {
      const ctx = document.createElement("canvas").getContext("2d")!;
      const veSRGB = (css: string): [number, number, number] => {
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      const b = getComputedStyle(document.body);
      return {
        nen: { css: b.backgroundColor, rgb: veSRGB(b.backgroundColor) },
        chu: { css: b.color, rgb: veSRGB(b.color) },
      };
    });

    const doSang = ([r, g, b]: [number, number, number]): number =>
      (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    expect(doSang(mau.nen.rgb), `Nền ${mau.nen.css} không đủ tối`).toBeLessThan(0.3);
    expect(doSang(mau.chu.rgb), `Chữ ${mau.chu.css} không đủ sáng`).toBeGreaterThan(0.6);
  });

  test("quay lại Sáng thì bỏ hẳn class dark", async ({ page }) => {
    await page.goto("/?app=1");
    await page.getByRole("button", { name: "Tài khoản" }).click();
    await page.getByRole("menuitemradio", { name: "Tối" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByRole("button", { name: "Tài khoản" }).click();
    await page.getByRole("menuitemradio", { name: "Sáng" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
