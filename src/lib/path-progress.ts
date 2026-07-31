/**
 * Tiến độ Lộ trình học từ A0 — lưu trong localStorage, không cần đăng nhập.
 */

import { FOUNDATION_LESSONS } from "./foundation-lessons";

const STORAGE_KEY = "path-progress-v1";

/** Phải đạt tỉ lệ đúng này mới được tính là hoàn thành và mở bài tiếp theo. */
export const PASS_THRESHOLD = 80;

export interface PathProgress {
  /** id của các bài vỡ lòng đã hoàn thành (đạt >= PASS_THRESHOLD). */
  completedLessons: string[];
  /** Điểm cao nhất từng đạt của mỗi bài, tính theo phần trăm. */
  lessonScores: Record<string, number>;
  /** Các từ nền tảng đã đánh dấu là thuộc. */
  learnedWords: string[];
  lastStudiedAt: string | null;
}

const EMPTY: PathProgress = {
  completedLessons: [],
  lessonScores: {},
  learnedWords: [],
  lastStudiedAt: null,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getPathProgress(): PathProgress {
  if (!isBrowser()) return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<PathProgress>;
    return {
      completedLessons: parsed.completedLessons ?? [],
      lessonScores: parsed.lessonScores ?? {},
      learnedWords: parsed.learnedWords ?? [],
      lastStudiedAt: parsed.lastStudiedAt ?? null,
    };
  } catch {
    return { ...EMPTY };
  }
}

function save(progress: PathProgress): PathProgress {
  if (isBrowser()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Hết dung lượng localStorage — bỏ qua, không làm hỏng trải nghiệm học.
    }
  }
  return progress;
}

/** Ghi lại kết quả một bài vỡ lòng. Trả về tiến độ mới. */
export function recordLessonResult(lessonId: string, scorePercent: number): PathProgress {
  const progress = getPathProgress();
  const best = Math.max(progress.lessonScores[lessonId] ?? 0, scorePercent);
  progress.lessonScores[lessonId] = best;
  if (best >= PASS_THRESHOLD && !progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId);
  }
  progress.lastStudiedAt = new Date().toISOString();
  return save(progress);
}

export function toggleLearnedWord(word: string): PathProgress {
  const progress = getPathProgress();
  const i = progress.learnedWords.indexOf(word);
  if (i >= 0) {
    progress.learnedWords.splice(i, 1);
  } else {
    progress.learnedWords.push(word);
  }
  progress.lastStudiedAt = new Date().toISOString();
  return save(progress);
}

export function resetPathProgress(): PathProgress {
  return save({ ...EMPTY, lessonScores: {}, completedLessons: [], learnedWords: [] });
}

/**
 * Bài đầu tiên luôn mở. Bài thứ n chỉ mở khi bài thứ n-1 đã hoàn thành.
 * Mục đích: người mới không nhảy vào giữa lộ trình rồi choáng.
 */
export function isLessonUnlocked(lessonId: string, progress: PathProgress): boolean {
  const idx = FOUNDATION_LESSONS.findIndex((l) => l.id === lessonId);
  if (idx <= 0) return true;
  const previous = FOUNDATION_LESSONS[idx - 1];
  return progress.completedLessons.includes(previous.id);
}

/** Chặng 0 (100 từ nền tảng) chỉ mở sau khi học xong toàn bộ Chặng −1. */
export function isStarterVocabUnlocked(progress: PathProgress): boolean {
  return FOUNDATION_LESSONS.every((l) => progress.completedLessons.includes(l.id));
}

export function foundationPercent(progress: PathProgress): number {
  if (FOUNDATION_LESSONS.length === 0) return 0;
  return Math.round(
    (progress.completedLessons.length / FOUNDATION_LESSONS.length) * 100,
  );
}

/** Bài tiếp theo nên học. Trả về null nếu đã xong hết Chặng −1. */
export function nextLessonId(progress: PathProgress): string | null {
  const next = FOUNDATION_LESSONS.find(
    (l) => !progress.completedLessons.includes(l.id),
  );
  return next ? next.id : null;
}
