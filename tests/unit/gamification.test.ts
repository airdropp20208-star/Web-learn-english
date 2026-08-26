import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type GamificationModule = typeof import("@/lib/gamification");

const NOW = new Date("2026-06-15T12:00:00.000Z");
const TODAY = "2026-06-15";
const YESTERDAY = "2026-06-14";
/**
 * Khoá cũ, thời chưa phân vùng theo người dùng. Dữ liệu ghi ở đây vẫn phải
 * đọc lại được (đường di trú), nhưng mọi lượt GHI mới đi vào khoá đã phân
 * vùng bên dưới.
 */
const LEGACY_KEY = "gamification-state";

/** Khoá thật hiện nay: gắn id người dùng đang hoạt động. */
const STORAGE_KEY = "gamification-state:local-user";

/**
 * gamification.ts giữ DEFAULT_STATE ở cấp module và load() trả thẳng nó ra.
 * Nếu không nạp lại module giữa các test, state rò rỉ từ test này sang test khác.
 */
async function fresh(): Promise<GamificationModule> {
  vi.resetModules();
  localStorage.clear();
  return import("@/lib/gamification");
}

function seed(partial: Record<string, unknown>) {
  localStorage.setItem(
    LEGACY_KEY,
    JSON.stringify({
      coins: 0,
      xp: 0,
      level: 1,
      streak: 0,
      lastStudyDate: null,
      todayProgress: {
        date: TODAY,
        wordsLearned: 0,
        wordsReviewed: 0,
        gamesPlayed: 0,
      },
      achievements: [],
      ...partial,
    })
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("xpForLevel / xpFloorForLevel / levelFromXp", () => {
  it.each([
    [1, 100],
    [2, 400],
    [5, 2500],
    [10, 10000],
  ])("xpForLevel(%d) = %d", async (level, expected) => {
    const g = await fresh();
    expect(g.xpForLevel(level)).toBe(expected);
  });

  it("level 1 bắt đầu từ 0 XP, không phải 100", async () => {
    const g = await fresh();
    expect(g.xpFloorForLevel(1)).toBe(0);
    expect(g.xpFloorForLevel(2)).toBe(400);
  });

  it.each([
    [0, 1],
    [399, 1],
    [400, 2],
    [899, 2],
    [900, 3],
    [2499, 4],
    [2500, 5],
    [10000, 10],
  ])("levelFromXp(%d) = %d", async (xp, expected) => {
    const g = await fresh();
    expect(g.levelFromXp(xp)).toBe(expected);
  });

  it("levelFromXp và xpFloorForLevel nhất quán với nhau", async () => {
    const g = await fresh();
    for (let level = 1; level <= 12; level++) {
      expect(g.levelFromXp(g.xpFloorForLevel(level))).toBe(level);
    }
  });
});

describe("getLevelProgress", () => {
  it("người mới (level 1, 0 XP) hiện 0%, không âm", async () => {
    const g = await fresh();
    const p = g.getLevelProgress(g.getState());
    expect(p.earned).toBe(0);
    expect(p.needed).toBe(400);
    expect(p.percent).toBe(0);
  });

  it("giữa level 1 tính đúng phần trăm", async () => {
    const g = await fresh();
    seed({ xp: 200, level: 1 });
    const p = g.getLevelProgress(g.getState());
    expect(p.earned).toBe(200);
    expect(p.percent).toBe(50);
  });

  it("phần trăm luôn nằm trong [0, 100]", async () => {
    const g = await fresh();
    const cases: Array<[number, number]> = [
      [0, 1],
      [50, 1],
      [400, 2],
      [99999, 2],
    ];
    for (const [xp, level] of cases) {
      const p = g.getLevelProgress({ ...g.getState(), xp, level });
      expect(p.percent).toBeGreaterThanOrEqual(0);
      expect(p.percent).toBeLessThanOrEqual(100);
    }
  });
});

describe("award — điểm thưởng", () => {
  it.each([
    ["learn-word", 10, 5],
    ["review-word", 15, 8],
    ["game-win", 50, 25],
    ["game-play", 20, 10],
    ["complete-deck", 200, 100],
    ["daily-login", 5, 2],
  ] as const)("%s cho %d XP và %d coin", async (action, xp, coins) => {
    const g = await fresh();
    const { state } = g.award(action);
    expect(state.xp).toBe(xp);
    expect(state.coins).toBe(coins);
  });

  it("nhân với amount", async () => {
    const g = await fresh();
    const { state } = g.award("learn-word", 3);
    expect(state.xp).toBe(30);
    expect(state.coins).toBe(15);
  });

  it("cộng dồn qua nhiều lần gọi", async () => {
    const g = await fresh();
    g.award("learn-word");
    const { state } = g.award("learn-word");
    expect(state.xp).toBe(20);
  });

  it("ghi state xuống localStorage", async () => {
    const g = await fresh();
    g.award("learn-word");
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).xp).toBe(10);
  });

  it("level tự lên theo XP", async () => {
    const g = await fresh();
    const { state } = g.award("complete-deck", 2); // 400 XP
    expect(state.level).toBe(2);
  });
});

describe("award — chuỗi ngày (streak)", () => {
  it("lần học đầu tiên đặt streak = 1", async () => {
    const g = await fresh();
    const { state } = g.award("learn-word");
    expect(state.streak).toBe(1);
    expect(state.lastStudyDate).toBe(TODAY);
  });

  it("học tiếp trong cùng ngày không tăng streak", async () => {
    const g = await fresh();
    g.award("learn-word");
    const { state } = g.award("learn-word");
    expect(state.streak).toBe(1);
  });

  it("học nối tiếp hôm qua thì streak tăng", async () => {
    const g = await fresh();
    seed({ streak: 4, lastStudyDate: YESTERDAY });
    const { state } = g.award("learn-word");
    expect(state.streak).toBe(5);
  });

  it("bỏ cách quãng thì streak reset về 1", async () => {
    const g = await fresh();
    seed({ streak: 12, lastStudyDate: "2026-06-01" });
    const { state } = g.award("learn-word");
    expect(state.streak).toBe(1);
  });
});

describe("award — thành tựu", () => {
  it("mở khoá 'first-word' ngay lần học đầu", async () => {
    const g = await fresh();
    const { state, newAchievements } = g.award("learn-word");
    expect(state.achievements).toContain("first-word");
    expect(newAchievements.map((a) => a.id)).toContain("first-word");
  });

  it("không trao lại thành tựu đã có", async () => {
    const g = await fresh();
    g.award("learn-word");
    const { newAchievements } = g.award("learn-word");
    expect(newAchievements.map((a) => a.id)).not.toContain("first-word");
  });

  it("mọi thành tựu đều có id duy nhất", async () => {
    const g = await fresh();
    const ids = g.ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("streak-3 mở khi đủ 3 ngày liên tiếp", async () => {
    const g = await fresh();
    seed({ streak: 2, lastStudyDate: YESTERDAY });
    const { state } = g.award("learn-word");
    expect(state.achievements).toContain("streak-3");
  });
});

describe("tiến độ hằng ngày", () => {
  it("mỗi loại hành động ghi vào đúng ô", async () => {
    const g = await fresh();
    g.award("learn-word", 2);
    g.award("review-word", 3);
    const { state } = g.award("game-play");
    expect(state.todayProgress.wordsLearned).toBe(2);
    expect(state.todayProgress.wordsReviewed).toBe(3);
    expect(state.todayProgress.gamesPlayed).toBe(1);
  });

  it("getDailyProgress cộng học mới + ôn lại", async () => {
    const g = await fresh();
    g.award("learn-word", 2);
    g.award("review-word", 3);
    const p = g.getDailyProgress();
    expect(p.current).toBe(5);
    expect(p.goal).toBe(10);
    expect(p.percent).toBe(50);
  });

  it("vượt chỉ tiêu vẫn chốt ở 100%", async () => {
    const g = await fresh();
    g.award("learn-word", 50);
    expect(g.getDailyProgress().percent).toBe(100);
  });

  it("sang ngày mới thì tiến độ ngày reset, XP thì không", async () => {
    const g = await fresh();
    seed({
      xp: 500,
      todayProgress: {
        date: YESTERDAY,
        wordsLearned: 9,
        wordsReviewed: 4,
        gamesPlayed: 2,
      },
    });
    const state = g.getState();
    expect(state.todayProgress.wordsLearned).toBe(0);
    expect(state.todayProgress.date).toBe(TODAY);
    expect(state.xp).toBe(500);
  });
});

describe("phân vùng theo người dùng", () => {
  it("đọc lại được dữ liệu ở khoá cũ và dời sang khoá mới", async () => {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ coins: 7, xp: 30 }));

    const g = await import("@/lib/gamification");
    expect(g.getGamificationSnapshot().coins).toBe(7);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("ghi vào khoá của người dùng đang hoạt động, không phải khoá chung", async () => {
    vi.resetModules();
    localStorage.clear();
    const active = await import("@/lib/active-user");
    const g = await import("@/lib/gamification");

    active.setActiveUserId("user-1");
    g.award("learn-word");

    expect(localStorage.getItem("gamification-state:user-1")).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });
});

describe("resetGamification", () => {
  it("xoá sạch dữ liệu đã lưu", async () => {
    const g = await fresh();
    g.award("complete-deck");
    g.resetGamification();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  // BUG: load() trả thẳng DEFAULT_STATE (singleton cấp module) khi chưa có dữ
  // liệu, rồi award() mutate ngay lên nó. Sau reset, "state mặc định" đã bẩn.
  // Trên server (typeof window === "undefined") singleton này dùng chung cho
  // MỌI request — điểm của người này chảy sang người khác.
  it("sau khi reset phải quay về 0 XP thật sự", async () => {
    const g = await fresh();
    g.award("complete-deck"); // +200 XP
    g.resetGamification();
    expect(g.getState().xp).toBe(0);
    expect(g.getState().coins).toBe(0);
    expect(g.getState().achievements).toEqual([]);
  });
});
