import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * Smoke test Phase 0: mở app, đi hết mọi tab, không tab nào được sập
 * hoặc ném lỗi ra console. Đây là lưới an toàn cho các phase sau —
 * nếu refactor làm hỏng một tab, test này đỏ ngay.
 */

const TABS = [
  { label: "Trang chủ", short: "Nhà" },
  { label: "Lộ trình", short: "Lộ trình" },
  { label: "Bộ từ", short: "Bộ từ" },
  { label: "Học", short: "Học" },
  { label: "Thư viện", short: "Đọc" },
  { label: "Game", short: "Game" },
  { label: "Hồ sơ", short: "Tôi" },
] as const;

/**
 * Lỗi console không phải do code app gây ra — bỏ qua để test không nhiễu.
 * Cố ý để danh sách này ngắn: mỗi mục là một thứ ta chấp nhận, không phải
 * chỗ để giấu lỗi thật.
 */
const IGNORED = [
  /Download the React DevTools/i,
  /favicon\.ico/i,
  /net::ERR_INTERNET_DISCONNECTED/i,
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED.some((re) => re.test(text))) return;
    errors.push(`[console] ${text}`);
  });
  page.on("pageerror", (err) => {
    if (IGNORED.some((re) => re.test(err.message))) return;
    errors.push(`[pageerror] ${err.message}`);
  });
  return errors;
}

/**
 * Vượt màn landing để vào app.
 *
 * Thử lại vòng click vì nút CTA chỉ ăn sau khi React hydrate xong; trên máy
 * chậm hoặc lần biên dịch đầu của dev server, lần click đầu có thể rơi vào
 * lúc handler chưa gắn.
 *
 * Ghi nhận cho Phase 4: `showLanding` luôn khởi tạo `true` và không được lưu,
 * nên người dùng phải bấm lại nút này ở MỌI lần vào app.
 */
async function enterApp(page: Page) {
  await page.goto("/");
  const cta = page.getByRole("button", { name: /Bắt đầu học miễn phí/ }).first();
  await expect(cta).toBeVisible();

  await expect(async () => {
    await cta.click({ timeout: 2_000 });
    await expect(page.getByRole("banner")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
}

test.describe("Smoke — toàn bộ tab", () => {
  test("landing hiện và vào được app", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /Bắt đầu học miễn phí/ }).first()
    ).toBeVisible();
    await enterApp(page);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  for (const tab of TABS) {
    test(`tab "${tab.label}" render được, không lỗi console`, async ({
      page,
      isMobile,
    }) => {
      const errors = collectErrors(page);
      await enterApp(page);

      const nav = isMobile
        ? page.locator("nav.fixed.bottom-0")
        : page.locator("aside");
      await nav
        .getByRole("button", { name: isMobile ? tab.short : tab.label, exact: true })
        .click();

      // Tiêu đề ở header phải đổi theo tab đang chọn
      await expect(page.getByRole("banner").getByRole("heading")).toHaveText(
        tab.label
      );
      // Vùng nội dung phải có gì đó, không được trắng trơn
      await expect(page.getByRole("main")).not.toBeEmpty();

      expect(errors, `Tab ${tab.label}:\n${errors.join("\n")}`).toEqual([]);
    });
  }

  test("đi tuần tự qua cả 7 tab không tích luỹ lỗi", async ({
    page,
    isMobile,
  }) => {
    const errors = collectErrors(page);
    await enterApp(page);

    const nav = isMobile
      ? page.locator("nav.fixed.bottom-0")
      : page.locator("aside");

    for (const tab of TABS) {
      await nav
        .getByRole("button", { name: isMobile ? tab.short : tab.label, exact: true })
        .click();
      await expect(page.getByRole("banner").getByRole("heading")).toHaveText(
        tab.label
      );
    }

    expect(errors, errors.join("\n")).toEqual([]);
  });
});

test.describe("Smoke — bố cục", () => {
  test("không tràn ngang", async ({ page }) => {
    await enterApp(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflow, "Trang bị tràn ngang").toBe(false);
  });

  test("thanh điều hướng đúng theo kích thước màn hình", async ({
    page,
    isMobile,
  }) => {
    await enterApp(page);
    if (isMobile) {
      await expect(page.locator("nav.fixed.bottom-0")).toBeVisible();
      await expect(page.locator("aside")).toBeHidden();
    } else {
      await expect(page.locator("aside")).toBeVisible();
      await expect(page.locator("nav.fixed.bottom-0")).toBeHidden();
    }
  });
});
