/**
 * Tiến độ Lộ trình học từ A0.
 *
 * Nguồn sự thật nằm ở localStorage, phân vùng theo người dùng đang hoạt động.
 * Khi đã đăng nhập, `src/lib/sync.ts` gương dữ liệu này lên server và hoà giải
 * theo `updatedAt`.
 */

import { FOUNDATION_LESSONS } from "./foundation-lessons";
import {
  getActiveUserId,
  readScopedFor,
  readWithLegacyFallback,
  scopedKey,
  subscribeActiveUser,
  writeScopedFor,
} from "./active-user";

/** Tiền tố khoá; khoá thật có gắn id người dùng — xem active-user.ts. */
export const STORAGE_PREFIX = "path-progress-v1";

/** Khoá của bản cũ, thời chưa phân vùng theo người dùng. */
const LEGACY_KEY = "path-progress-v1";

function storageKey(): string {
  return scopedKey(STORAGE_PREFIX);
}

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
  /**
   * Mốc ghi lần cuối, epoch ms. Đây là trường quyết định khi hoà giải xung đột
   * giữa máy này và server (last-write-wins).
   */
  updatedAt: number;
}

const EMPTY: PathProgress = {
  completedLessons: [],
  lessonScores: {},
  learnedWords: [],
  lastStudiedAt: null,
  updatedAt: 0,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function parseProgress(raw: string | null): PathProgress {
  if (!raw) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw) as Partial<PathProgress>;
    return {
      completedLessons: parsed.completedLessons ?? [],
      lessonScores: parsed.lessonScores ?? {},
      learnedWords: parsed.learnedWords ?? [],
      lastStudiedAt: parsed.lastStudiedAt ?? null,
      updatedAt: parsed.updatedAt ?? 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function getPathProgress(): PathProgress {
  if (!isBrowser()) return { ...EMPTY };
  return parseProgress(readWithLegacyFallback(STORAGE_PREFIX, LEGACY_KEY));
}

/** Tiến độ của một người dùng cụ thể, không phụ thuộc ai đang hoạt động. */
export function getPathProgressFor(userId: string): PathProgress {
  if (!isBrowser()) return { ...EMPTY };
  return parseProgress(readScopedFor(STORAGE_PREFIX, userId));
}

/**
 * Ghi đè toàn bộ tiến độ, giữ nguyên `updatedAt` được truyền vào.
 *
 * Chỉ engine đồng bộ mới nên gọi: nó vừa hoà giải xong với server và cần đặt
 * lại đúng mốc thời gian của bên thắng, chứ không phải đóng dấu "bây giờ" —
 * đóng dấu lại sẽ khiến bản ghi vừa kéo về luôn thắng ở lần đồng bộ sau.
 */
export function replacePathProgress(
  userId: string,
  progress: PathProgress
): PathProgress {
  writeScopedFor(STORAGE_PREFIX, userId, JSON.stringify(progress));
  // Xem giải thích ở replaceGamificationState: chỉ publish cho người đang dùng.
  if (userId === getActiveUserId()) publish(progress);
  return progress;
}

function save(progress: PathProgress): PathProgress {
  const stamped: PathProgress = { ...progress, updatedAt: Date.now() };
  if (isBrowser()) {
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify(stamped));
    } catch {
      // Hết dung lượng localStorage — bỏ qua, không làm hỏng trải nghiệm học.
    }
  }
  publish(stamped);
  return stamped;
}

// ==========================================================================
// Store cho React — dùng với `useSyncExternalStore`
// ==========================================================================

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Ảnh chụp hiện tại, giữ nguyên tham chiếu giữa các lần gọi.
 *
 * `getPathProgress()` dựng object mới mỗi lần gọi. Trả thẳng nó cho
 * `useSyncExternalStore` sẽ khiến React vẽ lại vô tận vì lần nào so bằng
 * `Object.is` cũng ra khác nhau.
 */
let snapshot: PathProgress | null = null;

/** Ảnh chụp phía server: hằng số dùng chung, tham chiếu không đổi. */
const SERVER_SNAPSHOT: PathProgress = Object.freeze({
  ...EMPTY,
  lessonScores: Object.freeze({}) as Record<string, number>,
});

function publish(next: PathProgress | null): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

// Đổi người dùng thì kho cũng đổi: bỏ cache để lần đọc sau lấy đúng khoá mới.
subscribeActiveUser(() => publish(null));

export function subscribePathProgress(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === storageKey() || e.key === null) publish(null);
  };
  if (isBrowser() && listeners.size === 1) {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (isBrowser()) window.removeEventListener("storage", onStorage);
  };
}

export function getPathProgressSnapshot(): PathProgress {
  if (!isBrowser()) return SERVER_SNAPSHOT;
  if (snapshot === null) snapshot = getPathProgress();
  return snapshot;
}

export function getPathProgressServerSnapshot(): PathProgress {
  return SERVER_SNAPSHOT;
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
