import { test, expect, type Page } from "@playwright/test";

/**
 * Rà bố cục ở ba bề ngang thật, cho cả chín tab.
 *
 * Tràn ngang là lỗi bố cục hay gặp nhất và cũng dễ lọt nhất: trên máy của
 * người viết code màn hình rộng nên không ai thấy, còn người dùng điện thoại
 * thì phải vuốt ngang mới đọc hết chữ. Đo bằng máy thay vì bằng mắt, và khi
 * đỏ thì chỉ luôn ra phần tử nào chọc ra ngoài — nếu chỉ báo "trang bị tràn"
 * thì vẫn phải ngồi dò tay.
 *
 * Chỉ chạy ở project desktop rồi tự đổi viewport: bề ngang là thứ quyết định
 * media query, còn thiết bị có cảm ứng hay không thì không liên quan ở đây.
 */

const VIEWPORTS = [
  { ten: "360px — điện thoại nhỏ", width: 360, height: 740 },
  { ten: "768px — tablet", width: 768, height: 1024 },
  { ten: "1280px — desktop", width: 1280, height: 800 },
] as const;

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

/** Ngưỡng md của Tailwind: từ đây trở lên là thanh bên, dưới là thanh dưới. */
const MD = 768;

test.skip(
  ({ isMobile }) => !!isMobile,
  "Spec này tự đặt viewport nên chỉ cần chạy một lần, ở project desktop."
);

async function moTab(
  page: Page,
  tab: (typeof TABS)[number],
  width: number
): Promise<void> {
  if (width >= MD) {
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
    // Nút trong ngăn kéo có cả dòng mô tả bên dưới nhãn, nên tên trợ năng của
    // nó là "Hồ sơ Thành tích, huy hiệu, cài đặt" chứ không phải "Hồ sơ" —
    // khớp theo tiền tố thay vì so bằng.
    await page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp("^" + tab.label) })
      .click();
  }
  await expect(page.getByRole("banner").getByRole("heading")).toHaveText(
    tab.label
  );
}

/**
 * Liệt kê phần tử chọc ra ngoài mép phải.
 *
 * Bỏ qua phần tử nằm trong vùng có `overflow-x` cuộn hoặc cắt: một bảng rộng
 * đặt trong khung cuộn ngang là cách xử lý đúng, không phải lỗi.
 */
async function phanTuTran(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const rongKhung = document.documentElement.clientWidth;

    function bịCắtBởiCha(el: Element): boolean {
      let cha = el.parentElement;
      while (cha && cha !== document.documentElement) {
        const ox = getComputedStyle(cha).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
        cha = cha.parentElement;
      }
      return false;
    }

    const xau: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right <= rongKhung + 1 && r.left >= -1) continue;
      if (bịCắtBởiCha(el)) continue;

      const lop = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 4).join(".");
      xau.push(
        `<${el.tagName.toLowerCase()}${lop ? "." + lop : ""}> ` +
          `left=${Math.round(r.left)} right=${Math.round(r.right)} (khung ${rongKhung})`
      );
      if (xau.length >= 6) break;
    }
    return xau;
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`Bố cục ở ${vp.ten}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const tab of TABS) {
      test(`tab "${tab.label}" không tràn ngang`, async ({ page }) => {
        await page.goto("/?app=1");
        await expect(page.getByRole("banner")).toBeVisible();
        await moTab(page, tab, vp.width);

        const tran = await phanTuTran(page);
        const cuonNgang = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        );

        expect(
          tran,
          `Phần tử chọc ra ngoài mép phải ở tab ${tab.label}:\n  ${tran.join("\n  ")}`
        ).toEqual([]);
        expect(cuonNgang, `Trang cuộn ngang được ở tab ${tab.label}`).toBe(false);
      });
    }

    test("thanh điều hướng đúng loại cho bề ngang này", async ({ page }) => {
      await page.goto("/?app=1");
      await expect(page.getByRole("banner")).toBeVisible();

      if (vp.width >= MD) {
        await expect(page.locator("aside")).toBeVisible();
        await expect(page.locator("nav.fixed.bottom-0")).toBeHidden();
      } else {
        await expect(page.locator("nav.fixed.bottom-0")).toBeVisible();
        await expect(page.locator("aside")).toBeHidden();
      }
    });
  });
}

test.describe("Vùng chạm trên thanh dưới", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("mỗi ô rộng và cao ít nhất 44px", async ({ page }) => {
    await page.goto("/?app=1");
    const o = page.locator("nav.fixed.bottom-0 button");
    const soO = await o.count();
    expect(soO).toBe(6); // năm tab chính cộng nút "Thêm"

    for (let i = 0; i < soO; i++) {
      const hop = await o.nth(i).boundingBox();
      const ten = (await o.nth(i).innerText()).trim() || `ô ${i}`;
      expect(hop, `Không đo được ${ten}`).not.toBeNull();
      expect(hop!.height, `Ô "${ten}" cao ${hop!.height}px`).toBeGreaterThanOrEqual(44);
      expect(hop!.width, `Ô "${ten}" rộng ${hop!.width}px`).toBeGreaterThanOrEqual(44);
    }
  });
});
