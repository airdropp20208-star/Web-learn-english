// Gamification system — Coin, Streak, Level/XP, Achievements, Daily goal
//
// Nguồn sự thật nằm ở localStorage, phân vùng theo người dùng đang hoạt động.
// Khi đã đăng nhập, src/lib/sync.ts gương dữ liệu này lên server và hoà giải
// theo updatedAt.

import {
  getActiveUserId,
  readScopedFor,
  readWithLegacyFallback,
  scopedKey,
  subscribeActiveUser,
  writeScopedFor,
} from "./active-user";

export interface GamificationState {
  coins: number;
  xp: number;
  level: number;
  streak: number;
  lastStudyDate: string | null; // YYYY-MM-DD
  todayProgress: {
    date: string; // YYYY-MM-DD
    wordsLearned: number;
    wordsReviewed: number;
    gamesPlayed: number;
  };
  achievements: string[]; // achievement IDs unlocked
  /**
   * Mốc ghi lần cuối, epoch ms. Trường quyết định khi hoà giải xung đột giữa
   * máy này và server (last-write-wins).
   */
  updatedAt: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  condition: (state: GamificationState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-word",
    name: "Bước đầu tiên",
    description: "Học từ vựng đầu tiên",
    icon: "🌱",
    condition: (s) => s.xp >= 10,
  },
  {
    id: "10-words",
    name: "Tập sự",
    description: "Học 10 từ vựng",
    icon: "📚",
    condition: (s) => s.xp >= 100,
  },
  {
    id: "50-words",
    name: "Hăng say",
    description: "Học 50 từ vựng",
    icon: "🔥",
    condition: (s) => s.xp >= 500,
  },
  {
    id: "100-words",
    name: "Bách chiến",
    description: "Học 100 từ vựng",
    icon: "💯",
    condition: (s) => s.xp >= 1000,
  },
  {
    id: "500-words",
    name: "Học bá",
    description: "Học 500 từ vựng",
    icon: "🎓",
    condition: (s) => s.xp >= 5000,
  },
  {
    id: "streak-3",
    name: "Kiên trì 3 ngày",
    description: "Học liên tiếp 3 ngày",
    icon: "⚡",
    condition: (s) => s.streak >= 3,
  },
  {
    id: "streak-7",
    name: "Tuần vàng",
    description: "Học liên tiếp 7 ngày",
    icon: "🌟",
    condition: (s) => s.streak >= 7,
  },
  {
    id: "streak-30",
    name: "Tháng sắt",
    description: "Học liên tiếp 30 ngày",
    icon: "👑",
    condition: (s) => s.streak >= 30,
  },
  {
    id: "level-5",
    name: "Lên level 5",
    description: "Đạt level 5",
    icon: "🚀",
    condition: (s) => s.level >= 5,
  },
  {
    id: "level-10",
    name: "Lên level 10",
    description: "Đạt level 10",
    icon: "🏆",
    condition: (s) => s.level >= 10,
  },
  {
    id: "coin-100",
    name: "Giàu có",
    description: "Tích lũy 100 coins",
    icon: "💰",
    condition: (s) => s.coins >= 100,
  },
  {
    id: "coin-1000",
    name: "Đại gia",
    description: "Tích lũy 1000 coins",
    icon: "💎",
    condition: (s) => s.coins >= 1000,
  },
];

/** Tiền tố khoá; khoá thật có gắn id người dùng — xem active-user.ts. */
export const STORAGE_PREFIX = "gamification-state";

/** Khoá của bản cũ, thời chưa phân vùng theo người dùng. */
const LEGACY_KEY = "gamification-state";

function storageKey(): string {
  return scopedKey(STORAGE_PREFIX);
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function emptyDailyProgress(): GamificationState["todayProgress"] {
  return {
    date: todayStr(),
    wordsLearned: 0,
    wordsReviewed: 0,
    gamesPlayed: 0,
  };
}

/**
 * Trạng thái khởi điểm — cố ý là HÀM, không phải hằng số dùng chung.
 *
 * Bản cũ giữ một object `DEFAULT_STATE` ở cấp module rồi `load()` trả thẳng
 * chính nó ra khi chưa có dữ liệu. `award()` mutate lên object nhận được, nên
 * "trạng thái mặc định" bị cộng điểm vĩnh viễn: sau `resetGamification()`
 * người dùng không quay về 0 XP mà về đúng số điểm đã lỡ tích vào hằng số.
 *
 * Trên server còn nặng hơn — `typeof window === "undefined"` khiến MỌI request
 * dùng chung một object, điểm của người này chảy sang người khác. Phase 2 sẽ
 * chạy code này phía server nên phải sạch từ bây giờ.
 *
 * `date` cũng phải tính lúc gọi: tính một lần lúc nạp module thì tab mở qua
 * nửa đêm sẽ mãi mang ngày hôm trước.
 */
function defaultState(): GamificationState {
  return {
    coins: 0,
    xp: 0,
    level: 1,
    streak: 0,
    lastStudyDate: null,
    todayProgress: emptyDailyProgress(),
    achievements: [],
    updatedAt: 0,
  };
}

function load(): GamificationState {
  return parseState(
    typeof window === "undefined"
      ? null
      : readWithLegacyFallback(STORAGE_PREFIX, LEGACY_KEY)
  );
}

/** Trạng thái của một người dùng cụ thể, không phụ thuộc ai đang hoạt động. */
export function getGamificationStateFor(userId: string): GamificationState {
  if (typeof window === "undefined") return defaultState();
  return parseState(readScopedFor(STORAGE_PREFIX, userId));
}

function parseState(raw: string | null): GamificationState {
  const base = defaultState();

  let parsed: Partial<GamificationState>;
  try {
    if (!raw) return base;
    parsed = JSON.parse(raw) as Partial<GamificationState>;
  } catch {
    // JSON hỏng hoặc localStorage bị chặn (chế độ riêng tư) — coi như người mới
    return base;
  }

  const state: GamificationState = {
    ...base,
    ...parsed,
    // Gộp nông sẽ để lọt `todayProgress` thiếu trường từ bản lưu cũ, rồi
    // `state.todayProgress.wordsLearned += n` cho ra NaN.
    todayProgress: { ...base.todayProgress, ...(parsed.todayProgress ?? {}) },
    achievements: [...(parsed.achievements ?? [])],
  };

  // Sang ngày mới thì tiến độ hôm nay bắt đầu lại
  if (state.todayProgress.date !== todayStr()) {
    state.todayProgress = emptyDailyProgress();
  }
  return state;
}

/**
 * Ghi trạng thái và đóng dấu thời gian.
 *
 * Đóng dấu bằng cách sửa thẳng vào object, không tạo bản sao: người gọi
 * (award) đã cầm tham chiếu này và sẽ publish nó ra cho React, nên bản sao sẽ
 * khiến UI hiện updatedAt cũ.
 */
function save(state: GamificationState): void {
  state.updatedAt = Date.now();
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state));
  } catch {
    // Hết dung lượng hoặc trình duyệt chặn ghi. Mất điểm còn hơn sập cả tab
    // học giữa chừng — nuốt lỗi ở đây là cố ý.
  }
}

/**
 * XP needed to reach next level.
 * Formula: level^2 * 100 (level 2 = 400 XP, level 5 = 2500 XP, level 10 = 10000 XP)
 */
export function xpForLevel(level: number): number {
  return level * level * 100;
}

/**
 * Mốc XP tại đó người dùng bắt đầu một level.
 * Level 1 luôn bắt đầu từ 0 XP — dùng xpForLevel(1) sẽ ra 100 và làm
 * thanh tiến độ hiện số âm cho người mới.
 */
export function xpFloorForLevel(level: number): number {
  return level <= 1 ? 0 : xpForLevel(level);
}

/**
 * Tiến độ XP trong level hiện tại: đã được bao nhiêu trên bao nhiêu.
 */
export function getLevelProgress(state: GamificationState): {
  earned: number;
  needed: number;
  percent: number;
} {
  const floor = xpFloorForLevel(state.level);
  const ceiling = xpForLevel(state.level + 1);
  const needed = Math.max(1, ceiling - floor);
  const earned = Math.max(0, state.xp - floor);
  return {
    earned,
    needed,
    percent: Math.max(0, Math.min(100, (earned / needed) * 100)),
  };
}

/**
 * Get level from total XP.
 */
export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) {
    level++;
  }
  return level;
}

/**
 * Award XP + coins for an action. Updates streak + daily progress.
 * Returns new state + any newly unlocked achievements.
 */
export function award(
  action: "learn-word" | "review-word" | "game-win" | "game-play" | "complete-deck" | "daily-login",
  amount: number = 1
): { state: GamificationState; newAchievements: Achievement[] } {
  const state = load();
  const oldAchievements = new Set(state.achievements);

  const rewards = {
    "learn-word": { xp: 10, coins: 5 },
    "review-word": { xp: 15, coins: 8 },
    "game-win": { xp: 50, coins: 25 },
    "game-play": { xp: 20, coins: 10 },
    "complete-deck": { xp: 200, coins: 100 },
    "daily-login": { xp: 5, coins: 2 },
  };

  const reward = rewards[action];
  state.xp += reward.xp * amount;
  state.coins += reward.coins * amount;
  state.level = levelFromXp(state.xp);

  // Update streak
  const today = todayStr();
  if (state.lastStudyDate !== today) {
    if (state.lastStudyDate) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      if (state.lastStudyDate === yesterday) {
        state.streak += 1;
      } else {
        state.streak = 1;
      }
    } else {
      state.streak = 1;
    }
    state.lastStudyDate = today;
  }

  // Update daily progress
  if (action === "learn-word") state.todayProgress.wordsLearned += amount;
  if (action === "review-word") state.todayProgress.wordsReviewed += amount;
  if (action === "game-play" || action === "game-win") state.todayProgress.gamesPlayed += amount;

  // Check achievements
  const newAchievements: Achievement[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (!oldAchievements.has(ach.id) && ach.condition(state)) {
      state.achievements.push(ach.id);
      newAchievements.push(ach);
    }
  }

  save(state);
  publish(state);
  return { state, newAchievements };
}

/**
 * Get current state (read-only).
 */
export function getState(): GamificationState {
  return getSnapshot();
}

/**
 * Daily goal: 10 words per day (learned + reviewed).
 */
export const DAILY_GOAL = 10;

export function getDailyProgress(): {
  current: number;
  goal: number;
  percent: number;
} {
  const state = getSnapshot();
  const current = state.todayProgress.wordsLearned + state.todayProgress.wordsReviewed;
  return {
    current,
    goal: DAILY_GOAL,
    percent: Math.min(100, (current / DAILY_GOAL) * 100),
  };
}

/**
 * Reset all gamification state (for testing).
 */
export function resetGamification(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey());
  publish(null);
}

/**
 * Ghi đè toàn bộ trạng thái, GIỮ NGUYÊN updatedAt được truyền vào.
 *
 * Chỉ engine đồng bộ mới nên gọi: nó vừa hoà giải xong với server và cần giữ
 * đúng mốc của bên thắng. Đóng dấu lại thành "bây giờ" sẽ khiến bản vừa kéo về
 * luôn thắng ở lần đồng bộ sau, và máy kia không bao giờ đẩy được gì lên.
 */
export function replaceGamificationState(
  userId: string,
  state: GamificationState
): void {
  writeScopedFor(STORAGE_PREFIX, userId, JSON.stringify(state));
  // Chỉ đẩy vào store React khi đang ghi cho chính người dùng hiện hành. Ghi
  // hộ một danh tính khác mà vẫn publish thì màn hình sẽ hiện điểm của người
  // không ngồi trước máy.
  if (userId === getActiveUserId()) publish(state);
}

// ==========================================================================
// Store cho React — dùng với `useSyncExternalStore`
// ==========================================================================
//
// Trước đây `page.tsx` đọc điểm bằng `setInterval(update, 5000)`: bộ đếm XP
// trên đầu trang trễ tới 5 giây sau mỗi lần cộng điểm, và vòng lặp chạy mãi kể
// cả khi người dùng không làm gì. Ở đây đổi sang mô hình đăng ký: `award()`
// báo ngay cho mọi component đang xem.

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Ảnh chụp hiện tại, giữ nguyên tham chiếu giữa các lần gọi.
 *
 * `useSyncExternalStore` so sánh kết quả `getSnapshot()` bằng `Object.is`.
 * Trả về object mới mỗi lần gọi sẽ khiến React vẽ lại vô tận — nên bắt buộc
 * phải cache và chỉ đổi tham chiếu khi dữ liệu thật sự đổi.
 */
let snapshot: GamificationState | null = null;

/** Ảnh chụp phía server: hằng số, dùng chung, KHÔNG ai được sửa. */
const SERVER_SNAPSHOT: GamificationState = Object.freeze(defaultState());

function getSnapshot(): GamificationState {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  if (snapshot === null) snapshot = load();
  return snapshot;
}

/** Bỏ cache và đánh thức người đăng ký. `next` = null nghĩa là đọc lại. */
function publish(next: GamificationState | null): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

// Đổi người dùng thì kho cũng đổi: bỏ cache để lần đọc sau lấy đúng khoá mới.
subscribeActiveUser(() => publish(null));

export function subscribeGamification(listener: Listener): () => void {
  listeners.add(listener);

  // Tab khác cùng trình duyệt ghi vào localStorage thì tab này cũng phải cập
  // nhật — sự kiện `storage` chỉ bắn sang các tab KHÁC, không bắn cho tab vừa ghi.
  const onStorage = (e: StorageEvent) => {
    if (e.key === storageKey() || e.key === null) publish(null);
  };
  if (typeof window !== "undefined" && listeners.size === 1) {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function getGamificationSnapshot(): GamificationState {
  return getSnapshot();
}

export function getGamificationServerSnapshot(): GamificationState {
  return SERVER_SNAPSHOT;
}
