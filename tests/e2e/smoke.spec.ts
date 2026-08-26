import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * Smoke test Phase 0: mở app, đi hết mọi tab, không tab nào được sập
 * hoặc ném lỗi ra console. Đây là lưới an toàn cho các phase sau —
 * nếu refactor làm hỏng một tab, test này đỏ ngay.
 */

const TABS = [
  { label: "Trang chủ", short: "Nhà", primary: true },
  { label: "Lộ trình", short: "Lộ trình", primary: true },
  { label: "Bộ từ", short: "Bộ từ", primary: true },
  { label: "Học", short: "Học", primary: true },
  { label: "Game", short: "Game", primary: true },
  { label: "Thư viện", short: "Đọc", primary: false },
  { label: "Tiến độ", short: "Tiến độ", primary: false },
  { label: "Luyện nói", short: "Nói", primary: false },
  { label: "Hồ sơ", short: "Tôi", primary: false },
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
 * Trạng thái này giờ được nhớ trong localStorage, nhưng mỗi test chạy trong
 * một context sạch nên landing vẫn hiện ở lần đầu — đúng như người dùng mới.
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

/**
 * Mở một tab. Trên điện thoại chỉ năm tab chính nằm trên thanh dưới; bốn tab
 * còn lại phải đi qua ngăn kéo "Thêm".
 */
async function moTab(page: Page, tab: (typeof TABS)[number], isMobile: boolean) {
  if (!isMobile) {
    await page
      .locator("aside")
      .getByRole("button", { name: tab.label, exact: true })
      .click();
  } else if (tab.primary) {
    await page
      .locator("nav.fixed.bottom-0")
      .getByRole("button", { name: tab.short, exact: true })
      .click();
  } else {
    await page.getByRole("button", { name: "Mở thêm mục" }).click();
    // Nút trong ngăn kéo mang cả dòng mô tả trong tên trợ năng, nên khớp theo
    // tiền tố thay vì so bằng.
    await page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp("^" + tab.label) })
      .click();
  }
  await expect(page.getByRole("banner").getByRole("heading")).toHaveText(tab.label);
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
      await moTab(page, tab, !!isMobile);

      // Vùng nội dung phải có gì đó, không được trắng trơn
      await expect(page.getByRole("main")).not.toBeEmpty();

      expect(errors, `Tab ${tab.label}:\n${errors.join("\n")}`).toEqual([]);
    });
  }

  test("đi tuần tự qua cả chín tab không tích luỹ lỗi", async ({
    page,
    isMobile,
  }) => {
    const errors = collectErrors(page);
    await enterApp(page);

    for (const tab of TABS) {
      await moTab(page, tab, !!isMobile);
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
