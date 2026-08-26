import { test, expect } from "@playwright/test";

/**
 * Header bảo mật là loại cấu hình dễ viết rồi quên: một lần ai đó sửa
 * `next.config.ts` cho gọn là mất, mà không có gì đỏ lên. Test này đọc header
 * thật từ response thật, nên xoá nhầm là biết ngay.
 *
 * Lưu ý: đây là dev server. CSP ở dev có thêm `'unsafe-eval'` và `ws:` cho
 * HMR, nên test chỉ khẳng định những phần giống nhau ở cả hai môi trường.
 */
test.describe("Header bảo mật", () => {
  test("trang chủ trả đủ các header cần thiết", async ({ page }) => {
    const res = await page.goto("/");
    expect(res, "không nhận được response nào").not.toBeNull();

    const h = res!.headers();

    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
  });

  test("Permissions-Policy chặn camera nhưng vẫn cho tab Luyện nói dùng mic", async ({
    page,
  }) => {
    const res = await page.goto("/");
    const pp = res!.headers()["permissions-policy"] ?? "";

    expect(pp, "phải chặn camera").toContain("camera=()");
    expect(pp, "phải chặn định vị").toContain("geolocation=()");
    // Đây là phần dễ làm hỏng nhất: siết mic là tab Luyện nói chết câm.
    expect(pp, "mic phải để self, nếu không tab Luyện nói không ghi âm được").toContain(
      "microphone=(self)"
    );
  });

  test("CSP chặn nhúng iframe, plugin và đổi base URL", async ({ page }) => {
    const res = await page.goto("/");
    const csp = res!.headers()["content-security-policy"] ?? "";

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  test("app vẫn chạy bình thường dưới CSP — không có vi phạm nào khi vào app", async ({
    page,
  }) => {
    const viPham: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (/Content Security Policy|Refused to /i.test(t)) viPham.push(t);
    });

    await page.goto("/?app=1");
    // `main` là thứ duy nhất chắc chắn hiện ở cả desktop lẫn mobile — thanh
    // bên `aside` bị ẩn dưới 768px, nên nó không dùng làm mốc được.
    await expect(page.locator("main")).toBeVisible();

    expect(viPham, `CSP chặn nhầm:\n${viPham.join("\n")}`).toHaveLength(0);
  });
});
