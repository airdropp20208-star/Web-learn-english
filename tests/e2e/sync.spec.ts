import { expect, test } from "@playwright/test";

/**
 * Chứng minh vòng đồng bộ thật: khách → đăng ký → nhập dữ liệu → thấy lại ở
 * một trình duyệt khác hoàn toàn.
 *
 * Đây là bài kiểm tra duy nhất trả lời được câu hỏi "backend có thật sự hoạt
 * động không". Mọi test khác chỉ chạm một nửa: unit test không có database,
 * integration test không có trình duyệt.
 *
 * **Chạy khi nào:** cần `DATABASE_URL` và `AUTH_SECRET` khi khởi động dev
 * server (Playwright truyền nguyên `process.env` xuống webServer).
 *
 *     node scripts/pglite-server.mjs &
 *     export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres
 *     export AUTH_SECRET=$(openssl rand -base64 32)
 *     npx prisma migrate deploy
 *     npx playwright test tests/e2e/sync.spec.ts
 */

const hasDb = Boolean(process.env.DATABASE_URL && process.env.AUTH_SECRET);

test.describe("Đồng bộ đa thiết bị", () => {
  test.skip(!hasDb, "Cần DATABASE_URL và AUTH_SECRET.");
  // Đăng ký + hai lượt đồng bộ qua mạng — rộng tay hơn mặc định 60s.
  test.setTimeout(120_000);

  test("dữ liệu khách theo được vào tài khoản và sang trình duyệt khác", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const email = `e2e-sync-${stamp}@example.test`;
    const password = "matkhau-du-dai-123";
    const COINS = 4242;
    const XP = 777;

    // ---------------------------------------------------------------
    // Trình duyệt 1 — học ở chế độ khách, rồi đăng ký
    // ---------------------------------------------------------------
    const ctx1 = await browser.newContext();
    const p1 = await ctx1.newPage();

    await p1.goto("/?app=1");
    // Gieo thẳng vào localStorage thay vì bấm qua UI: bài test này kiểm tra
    // đường đi của dữ liệu, không phải cách kiếm điểm. Bấm qua UI làm nó gãy
    // mỗi lần luật tính điểm đổi.
    await p1.evaluate(
      ({ coins, xp, now }) => {
        localStorage.setItem(
          "gamification-state:local-user",
          JSON.stringify({
            coins,
            xp,
            level: 5,
            streak: 3,
            lastStudyDate: "2026-08-25",
            todayProgress: {
              date: "2026-08-25",
              wordsLearned: 9,
              wordsReviewed: 21,
              gamesPlayed: 2,
            },
            achievements: ["first-word"],
            updatedAt: now,
          })
        );
      },
      { coins: COINS, xp: XP, now: stamp }
    );

    // Đăng ký tài khoản mới.
    await p1.goto("/dang-nhap");
    await p1.getByRole("button", { name: /tạo mới/i }).click();
    await p1.getByLabel("Email").fill(email);
    await p1.getByLabel("Mật khẩu").fill(password);
    await p1.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();

    // Lời mời nhập dữ liệu khách phải tự hiện lên.
    const claim = p1.getByRole("alertdialog");
    await expect(claim).toContainText("Nhập tiến độ đang có trên máy này?");
    await claim.getByRole("button", { name: /nhập vào tài khoản/i }).click();
    await expect(claim).toBeHidden({ timeout: 30_000 });

    // Đã đẩy lên server chưa — hỏi thẳng API thay vì đoán qua UI.
    const pushed = await p1.evaluate(async () => {
      const res = await fetch("/api/sync", { cache: "no-store" });
      return { status: res.status, body: await res.json() };
    });
    expect(pushed.status).toBe(200);
    // So theo khoảng chứ không so bằng: mở trang chủ là app tự cộng điểm danh
    // hằng ngày (+2 xu, +5 xp), nên con số nhích lên vài đơn vị mới là đúng.
    // Điều cần chứng minh là tài khoản này mang tiến độ của khách — không tài
    // khoản trắng nào tự nhiên có hơn bốn nghìn xu.
    expect(pushed.body.gamification?.coins).toBeGreaterThanOrEqual(COINS);
    expect(pushed.body.gamification?.coins).toBeLessThan(COINS + 100);

    await ctx1.close();

    // ---------------------------------------------------------------
    // Trình duyệt 2 — máy hoàn toàn mới, chỉ có email và mật khẩu
    // ---------------------------------------------------------------
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();

    await p2.goto("/dang-nhap");
    await p2.getByLabel("Email").fill(email);
    await p2.getByLabel("Mật khẩu").fill(password);
    await p2.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await p2.waitForURL(/\/(\?|$)/, { timeout: 30_000 });

    const pulled = await p2.evaluate(async () => {
      const res = await fetch("/api/sync", { cache: "no-store" });
      return { status: res.status, body: await res.json() };
    });
    expect(pulled.status).toBe(200);
    expect(pulled.body.gamification?.coins).toBeGreaterThanOrEqual(COINS);
    expect(pulled.body.gamification?.coins).toBeLessThan(COINS + 100);
    expect(pulled.body.gamification?.xp).toBeGreaterThanOrEqual(XP);
    expect(pulled.body.gamification?.xp).toBeLessThan(XP + 100);

    await ctx2.close();
  });

  test("chưa đăng nhập thì /api/sync trả 401 chứ không trả dữ liệu người khác", async ({
    page,
  }) => {
    await page.goto("/?app=1");
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/sync", { cache: "no-store" });
      return { status: r.status, body: await r.json() };
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Chưa đăng nhập.");
  });
});
