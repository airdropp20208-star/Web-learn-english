// Gamification system — Coin, Streak, Level/XP, Achievements, Daily goal
// All state persisted in localStorage

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

const STORAGE_KEY = "gamification-state";

const DEFAULT_STATE: GamificationState = {
  coins: 0,
  xp: 0,
  level: 1,
  streak: 0,
  lastStudyDate: null,
  todayProgress: {
    date: todayStr(),
    wordsLearned: 0,
    wordsReviewed: 0,
    gamesPlayed: 0,
  },
  achievements: [],
};

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function load(): GamificationState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const state = { ...DEFAULT_STATE, ...JSON.parse(raw) };
    // Reset daily progress if new day
    if (state.todayProgress.date !== todayStr()) {
      state.todayProgress = {
        date: todayStr(),
        wordsLearned: 0,
        wordsReviewed: 0,
        gamesPlayed: 0,
      };
    }
    return state;
  } catch {
    return DEFAULT_STATE;
  }
}

function save(state: GamificationState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  return { state, newAchievements };
}

/**
 * Get current state (read-only).
 */
export function getState(): GamificationState {
  return load();
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
  const state = load();
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
  localStorage.removeItem(STORAGE_KEY);
}
