/**
 * Đồng bộ dữ liệu học giữa trình duyệt và server.
 *
 * ## Vì sao là local-first chứ không phải "đọc/ghi thẳng server"
 *
 * Kế hoạch ban đầu định thay ruột các module lưu trữ bằng lời gọi mạng, giữ
 * nguyên chữ ký hàm. Làm được với `storage.ts` và `deck-storage.ts` vì chúng
 * đã `async`. Nhưng `gamification.ts` và `path-progress.ts` có API đồng bộ và
 * đã nối vào `useSyncExternalStore` — thứ này bắt buộc `getSnapshot()` trả về
 * ngay lập tức. Không có cách nào để một lời gọi mạng làm được điều đó.
 *
 * Nên: mọi ghi vẫn vào localStorage (tức thì, chạy được cả khi mất mạng), và
 * module này gương dữ liệu lên server ở nền.
 *
 * ## Giải xung đột
 *
 * Last-write-wins **ở mức từng bản ghi**, so bằng `updatedAt`. Không phải LWW
 * cả kho — cách đó sẽ khiến học trên điện thoại lúc sáng bị mất trắng khi mở
 * máy tính buổi tối. So từng bản ghi thì hai bên chỉ chọi nhau khi cùng sửa
 * đúng một thẻ.
 *
 * Với bản ghi chỉ tạo-không-sửa (câu hỏi quiz, phiên luyện nói), hợp nhất là
 * phép hợp theo id — không có gì để chọi.
 *
 * ## Giới hạn đã biết
 *
 * Mỗi lần đồng bộ đẩy/kéo toàn bộ ảnh chụp. Với vài trăm KB như quy mô hiện
 * tại thì không sao; tới hàng chục nghìn bản ghi sẽ phải chuyển sang đồng bộ
 * theo delta (chỉ gửi những gì đổi từ mốc `since`).
 */

import type {
  MemoryItemDTO,
  QuizQuestionDTO,
  ShadowSessionDTO,
  TextDTO,
  UserProgressDTO,
  VocabItemDTO,
} from "./types";
import {
  clearScopedFor,
  getActiveUserId,
  subscribeActiveUser,
} from "./active-user";
import { DEFAULT_USER_ID, isGuestId } from "./user-id";
import {
  getMemoryItems,
  getQuizQuestions,
  getShadowSessions,
  getTexts,
  getUserProgress,
  getVocabItems,
  clearLocalCollections,
  replaceLocalCollections,
} from "./storage-local";
import {
  clearDeckData,
  clearDeckTombstones,
  getDeckSubscriptionsFor,
  getDeckTombstonesFor,
  replaceDeckSubscriptions,
  SUB_PREFIX as DECK_SUB_PREFIX,
  TOMB_PREFIX as DECK_TOMB_PREFIX,
  type DeckSubscription,
} from "./deck-storage-local";
import {
  STORAGE_PREFIX as PATH_PROGRESS_PREFIX,
  getPathProgressFor,
  replacePathProgress,
  resetPathProgress,
  subscribePathProgress,
  type PathProgress,
} from "./path-progress";
import {
  STORAGE_PREFIX as GAMIFICATION_PREFIX,
  getGamificationStateFor,
  levelFromXp,
  replaceGamificationState,
  resetGamification,
  subscribeGamification,
  type GamificationState,
} from "./gamification";

// ==========================================================================
// Hình dạng dữ liệu trao đổi
// ==========================================================================

export interface SyncSnapshot {
  texts: TextDTO[];
  vocabItems: VocabItemDTO[];
  memoryItems: MemoryItemDTO[];
  quizQuestions: QuizQuestionDTO[];
  shadowSessions: ShadowSessionDTO[];
  userProgress: UserProgressDTO | null;
  pathProgress: PathProgress | null;
  gamification: GamificationState | null;
  deckSubscriptions: DeckSubscription[];
  /** deckId -> mốc huỷ đăng ký (epoch ms). Xem giải thích ở deck-storage-local. */
  deckTombstones: Record<string, number>;
}

export function emptySnapshot(): SyncSnapshot {
  return {
    texts: [],
    vocabItems: [],
    memoryItems: [],
    quizQuestions: [],
    shadowSessions: [],
    userProgress: null,
    pathProgress: null,
    gamification: null,
    deckSubscriptions: [],
    deckTombstones: {},
  };
}

// ==========================================================================
// Hợp nhất — hàm thuần, không đụng tới localStorage hay mạng
// ==========================================================================

interface Stamped {
  id: string;
  updatedAt: number;
}

/**
 * Hợp nhất hai danh sách bản ghi có thể sửa: hợp theo id, `updatedAt` lớn hơn
 * thắng. Hoà thì lấy bên local — người dùng đang ngồi trước máy này, và giữ
 * nguyên tham chiếu tránh một lượt ghi lại thừa.
 */
export function mergeById<T extends Stamped>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of remote) byId.set(item.id, item);
  for (const item of local) {
    const existing = byId.get(item.id);
    if (!existing || item.updatedAt >= existing.updatedAt) byId.set(item.id, item);
  }
  return [...byId.values()];
}

/** Hợp nhất bản ghi chỉ tạo-không-sửa: hợp theo id, bên nào có trước cũng như nhau. */
export function unionById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of remote) byId.set(item.id, item);
  for (const item of local) byId.set(item.id, item);
  return [...byId.values()];
}

/** Hợp nhất một bản ghi đơn lẻ. `null` thua bất kỳ giá trị nào. */
export function mergeSingle<T extends { updatedAt: number }>(
  local: T | null,
  remote: T | null
): T | null {
  if (!local) return remote;
  if (!remote) return local;
  return local.updatedAt >= remote.updatedAt ? local : remote;
}

/**
 * Hợp nhất đăng ký deck, có tính bia mộ.
 *
 * Một deck bị bỏ đi khi mốc xoá mới hơn lần sửa cuối của bản ghi. Nếu người
 * dùng huỷ trên máy A rồi học tiếp deck đó trên máy B, bản ghi của B mới hơn
 * bia mộ của A và deck ở lại — đúng ý định gần nhất của người dùng.
 */
export function mergeDeckSubscriptions(
  local: DeckSubscription[],
  remote: DeckSubscription[],
  tombstones: Record<string, number>
): DeckSubscription[] {
  return mergeById(
    local.map((s) => ({ ...s, id: s.deckId })),
    remote.map((s) => ({ ...s, id: s.deckId }))
  )
    .filter((s) => {
      const deletedAt = tombstones[s.deckId];
      return deletedAt === undefined || deletedAt < s.updatedAt;
    })
    .map(({ id: _id, ...rest }) => rest as DeckSubscription);
}

export function mergeSnapshots(
  local: SyncSnapshot,
  remote: SyncSnapshot
): SyncSnapshot {
  // Bia mộ của hai bên cộng lại; cùng một deck thì lấy mốc xoá muộn hơn.
  const tombstones: Record<string, number> = { ...remote.deckTombstones };
  for (const [deckId, at] of Object.entries(local.deckTombstones)) {
    tombstones[deckId] = Math.max(tombstones[deckId] ?? 0, at);
  }

  return {
    texts: mergeById(local.texts, remote.texts),
    vocabItems: mergeById(local.vocabItems, remote.vocabItems),
    memoryItems: mergeById(local.memoryItems, remote.memoryItems),
    quizQuestions: unionById(local.quizQuestions, remote.quizQuestions),
    shadowSessions: unionById(local.shadowSessions, remote.shadowSessions),
    userProgress: mergeSingle(local.userProgress, remote.userProgress),
    pathProgress: mergeSingle(local.pathProgress, remote.pathProgress),
    gamification: mergeSingle(local.gamification, remote.gamification),
    deckSubscriptions: mergeDeckSubscriptions(
      local.deckSubscriptions,
      remote.deckSubscriptions,
      tombstones
    ),
    deckTombstones: tombstones,
  };
}

// ==========================================================================
// Gộp hồ sơ — chỉ dùng cho luồng nhập dữ liệu khách
// ==========================================================================
//
// Vì sao phải có luật riêng ở đây, không dùng LWW như mọi chỗ khác:
//
// Hồ sơ điểm và tiến độ lộ trình là hai bản ghi ĐƠN, nên LWW áp lên cả khối
// chứ không lên từng mục. Bình thường không sao. Nhưng ngay lúc nhập dữ liệu
// khách thì nó sai nặng: tài khoản vừa tạo đã kịp có một bản ghi "điểm danh"
// đóng dấu `bây giờ` — mới hơn về thời gian nhưng gần như rỗng về nội dung —
// và nó nuốt trọn tiến độ khách tích cóp nhiều ngày. Người dùng bấm "Nhập vào
// tài khoản" rồi thấy mình mất sạch.
//
// Nên ở đây so nội dung chứ không so đồng hồ: giữ thành tích cao hơn của mỗi
// bên. Bảo thủ theo đúng nghĩa cần thiết — không bịa ra điểm mới, và không
// làm mất điểm của bên nào.

function mergeDailyProgress(
  a: GamificationState["todayProgress"],
  b: GamificationState["todayProgress"]
): GamificationState["todayProgress"] {
  // Cùng một ngày thì hai bên là hai phần việc khác nhau của cùng người —
  // cộng lại. Khác ngày thì con số của ngày cũ không còn nghĩa gì.
  if (a.date === b.date) {
    return {
      date: a.date,
      wordsLearned: a.wordsLearned + b.wordsLearned,
      wordsReviewed: a.wordsReviewed + b.wordsReviewed,
      gamesPlayed: a.gamesPlayed + b.gamesPlayed,
    };
  }
  return a.date >= b.date ? a : b;
}

export function mergeGamificationProfiles(
  a: GamificationState | null,
  b: GamificationState | null
): GamificationState | null {
  if (!a) return b;
  if (!b) return a;

  const xp = Math.max(a.xp, b.xp);
  return {
    coins: Math.max(a.coins, b.coins),
    xp,
    // Tính lại từ xp thay vì lấy max: level là hàm của xp, giữ hai giá trị
    // rời nhau sẽ có lúc lệch.
    level: levelFromXp(xp),
    streak: Math.max(a.streak, b.streak),
    lastStudyDate:
      (a.lastStudyDate ?? "") >= (b.lastStudyDate ?? "")
        ? a.lastStudyDate
        : b.lastStudyDate,
    todayProgress: mergeDailyProgress(a.todayProgress, b.todayProgress),
    achievements: [...new Set([...a.achievements, ...b.achievements])],
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

export function mergePathProgressProfiles(
  a: PathProgress | null,
  b: PathProgress | null
): PathProgress | null {
  if (!a) return b;
  if (!b) return a;

  const lessonScores = { ...a.lessonScores };
  for (const [id, score] of Object.entries(b.lessonScores)) {
    lessonScores[id] = Math.max(lessonScores[id] ?? 0, score);
  }
  // `lastStudiedAt` là chuỗi ISO chứ không phải epoch — so trực tiếp được vì
  // ISO 8601 sắp xếp theo thứ tự từ điển đúng bằng thứ tự thời gian.
  const lastStudiedAt =
    (a.lastStudiedAt ?? "") >= (b.lastStudiedAt ?? "")
      ? a.lastStudiedAt
      : b.lastStudiedAt;

  return {
    completedLessons: [
      ...new Set([...a.completedLessons, ...b.completedLessons]),
    ],
    lessonScores,
    learnedWords: [...new Set([...a.learnedWords, ...b.learnedWords])],
    lastStudiedAt,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

// ==========================================================================
// Đọc / ghi phía trình duyệt
// ==========================================================================

export async function collectLocalSnapshot(userId: string): Promise<SyncSnapshot> {
  const [texts, vocabItems, memoryItems, shadowSessions, userProgress] =
    await Promise.all([
      getTexts(userId),
      getVocabItems(userId),
      getMemoryItems(userId),
      getShadowSessions(userId),
      getUserProgress(userId),
    ]);

  // Câu hỏi quiz được lưu theo bài đọc, nên phải gom qua từng bài.
  const quizGroups = await Promise.all(
    texts.map((t) => getQuizQuestions(userId, t.id))
  );

  // Ba kho dưới đây đọc theo `userId` truyền vào chứ không theo người đang
  // hoạt động. Khác biệt chỉ lộ ra ở luồng nhập dữ liệu khách — lúc đó ta cần
  // đọc kho của khách trong khi người hoạt động đã là tài khoản thật.
  return {
    texts,
    vocabItems,
    memoryItems,
    quizQuestions: quizGroups.flat(),
    shadowSessions,
    userProgress,
    pathProgress: getPathProgressFor(userId),
    gamification: getGamificationStateFor(userId),
    deckSubscriptions: getDeckSubscriptionsFor(userId),
    deckTombstones: getDeckTombstonesFor(userId),
  };
}

/**
 * Có dấu vết học nào của `userId` trên máy này không.
 *
 * Dùng để quyết định có hỏi "nhập tiến độ khách vào tài khoản?" hay không.
 * Chỉ đếm thứ người dùng thật sự làm ra — mở app rồi đóng ngay không tính.
 */
export async function hasLocalData(userId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const snap = await collectLocalSnapshot(userId);
  return (
    snap.texts.length > 0 ||
    snap.vocabItems.length > 0 ||
    snap.memoryItems.length > 0 ||
    snap.shadowSessions.length > 0 ||
    snap.deckSubscriptions.length > 0 ||
    (snap.pathProgress?.completedLessons.length ?? 0) > 0 ||
    (snap.gamification?.xp ?? 0) > 0 ||
    (snap.gamification?.coins ?? 0) > 0
  );
}

/**
 * Chuyển dữ liệu khách trên máy này vào tài khoản đang đăng nhập.
 *
 * Hợp nhất chứ không ghi đè: nếu tài khoản đã có dữ liệu, LWW theo từng bản
 * ghi quyết định — đúng như mọi lượt đồng bộ khác. Xong thì xoá kho khách để
 * lần đăng xuất sau không thấy bản sao ma của chính mình.
 */
export async function claimGuestData(targetUserId: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (isGuestId(targetUserId)) return;

  const [guest, mine] = await Promise.all([
    collectLocalSnapshot(DEFAULT_USER_ID),
    collectLocalSnapshot(targetUserId),
  ]);

  const merged = mergeSnapshots(mine, guest);
  // Hai bản ghi đơn này cần luật gộp riêng — xem khối "Gộp hồ sơ" ở trên.
  merged.gamification = mergeGamificationProfiles(
    mine.gamification,
    guest.gamification
  );
  merged.pathProgress = mergePathProgressProfiles(
    mine.pathProgress,
    guest.pathProgress
  );
  // Đóng dấu "bây giờ" cho bản gộp: người dùng vừa quyết định nhập, và quyết
  // định đó phải thắng cả bản mà server đang giữ. Không đóng dấu thì lượt đồng
  // bộ ngay sau đây kéo bản cũ hơn của server về và xoá công vừa làm.
  const claimedAt = Date.now();
  if (merged.gamification) merged.gamification.updatedAt = claimedAt;
  if (merged.pathProgress) merged.pathProgress.updatedAt = claimedAt;

  applySnapshot(targetUserId, merged);
  clearLocalCollections(DEFAULT_USER_ID);
  clearGuestScopedStores();
  await syncNow();
}

/**
 * Xoá ba kho phân vùng của khách.
 *
 * Không dùng được `clearDeckData`/`resetGamification`/`resetPathProgress` ở
 * đây: chúng đều thao tác trên người dùng đang hoạt động, mà lúc này người
 * hoạt động là tài khoản thật.
 */
function clearGuestScopedStores(): void {
  for (const prefix of [
    DECK_SUB_PREFIX,
    DECK_TOMB_PREFIX,
    GAMIFICATION_PREFIX,
    PATH_PROGRESS_PREFIX,
  ]) {
    clearScopedFor(prefix, DEFAULT_USER_ID);
  }
}

/** Ghi ảnh chụp đã hợp nhất trở lại localStorage. */
export function applySnapshot(userId: string, snapshot: SyncSnapshot): void {
  replaceLocalCollections(userId, {
    texts: snapshot.texts,
    vocabItems: snapshot.vocabItems,
    memoryItems: snapshot.memoryItems,
    quizQuestions: snapshot.quizQuestions,
    shadowSessions: snapshot.shadowSessions,
    userProgress: snapshot.userProgress,
  });
  if (snapshot.pathProgress) replacePathProgress(userId, snapshot.pathProgress);
  if (snapshot.gamification) {
    replaceGamificationState(userId, snapshot.gamification);
  }
  replaceDeckSubscriptions(userId, snapshot.deckSubscriptions);
}

// ==========================================================================
// Vòng đời đồng bộ
// ==========================================================================

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

let status: SyncStatus = "idle";
let lastSyncedAt: number | null = null;
let lastError: string | null = null;

const statusListeners = new Set<() => void>();

function setStatus(next: SyncStatus, error: string | null = null): void {
  status = next;
  lastError = error;
  statusSnapshot = null;
  for (const listener of statusListeners) listener();
}

export function subscribeSyncStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export interface SyncStatusSnapshot {
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
}

/**
 * Ảnh chụp được nhớ lại chứ không dựng mới mỗi lần gọi.
 *
 * `useSyncExternalStore` so sánh kết quả `getSnapshot()` bằng `Object.is`; trả
 * về một object mới mỗi lần là vòng lặp vẽ vô tận. Đặt lại thành `null` ở
 * đúng hai chỗ ghi trạng thái bên dưới.
 */
let statusSnapshot: SyncStatusSnapshot | null = null;

/** Ảnh chụp cố định cho lần render trên server — ở đó không có gì đồng bộ cả. */
const SERVER_STATUS_SNAPSHOT: SyncStatusSnapshot = {
  status: "idle",
  lastSyncedAt: null,
  error: null,
};

export function getSyncStatus(): SyncStatusSnapshot {
  if (statusSnapshot === null) {
    statusSnapshot = { status, lastSyncedAt, error: lastError };
  }
  return statusSnapshot;
}

export function getServerSyncStatus(): SyncStatusSnapshot {
  return SERVER_STATUS_SNAPSHOT;
}

/** Lượt đồng bộ đang chạy, nếu có. */
let inFlight: Promise<void> | null = null;

/**
 * Lượt đã xếp sẵn để chạy ngay sau lượt hiện tại.
 *
 * Vì sao phải xếp thay vì dùng lại lượt đang chạy: bước đầu tiên của một lượt
 * là chụp ảnh dữ liệu cục bộ, nên nó không thể chứa thứ được ghi sau đó. Trả
 * promise của nó cho người gọi mới là nói dối — `await syncNow()` báo "xong"
 * trong khi thay đổi vừa rồi vẫn nằm nguyên trên máy. Chính chỗ này từng nuốt
 * mất luồng nhập dữ liệu khách: bấm "Nhập vào tài khoản" xong thì hộp thoại
 * đợi một lượt đồng bộ đã khởi động từ lúc đăng nhập, tức là từ trước khi dữ
 * liệu được gộp.
 *
 * Một chỗ xếp là đủ: mọi người gọi đến trong lúc lượt hiện tại chạy đều được
 * phục vụ bởi cùng một lượt kế tiếp, vì lượt đó chụp ảnh sau tất cả họ.
 */
let queued: Promise<void> | null = null;

/**
 * Chạy một lượt đồng bộ đầy đủ: kéo về, hợp nhất, ghi lại máy, đẩy lên.
 *
 * Đẩy nguyên bản đã hợp nhất chứ không chỉ phần thay đổi. Hơi tốn băng thông
 * nhưng bù lại thao tác là idempotent: chạy lại sau khi mạng đứt giữa chừng
 * không để lại trạng thái nửa vời.
 *
 * Không bao giờ ném: mọi lỗi đi vào trạng thái để UI hiển thị.
 */
async function runSync(userId: string): Promise<void> {
  {
    setStatus("syncing");
    try {
      const local = await collectLocalSnapshot(userId);

      const pullRes = await fetch("/api/sync", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!pullRes.ok) throw new Error(`Kéo dữ liệu thất bại (${pullRes.status})`);
      const remote = (await pullRes.json()) as SyncSnapshot;

      const merged = mergeSnapshots(local, { ...emptySnapshot(), ...remote });

      // Chụp lại lần nữa trước khi ghi xuống. Trong khoảng chờ mạng ở trên,
      // người dùng vẫn học và các store vẫn ghi — ghi thẳng `merged` là đè lên
      // những thứ đó bằng một ảnh chụp đã cũ, và điểm vừa kiếm được biến mất
      // không dấu vết. Hợp nhất thêm một lượt là đủ: bản ghi mới hơn tự thắng
      // theo đúng luật LWW sẵn có, không cần khoá hay hàng đợi gì thêm.
      const fresh = await collectLocalSnapshot(userId);
      const toWrite = mergeSnapshots(fresh, merged);

      applySnapshot(userId, toWrite);

      const pushRes = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toWrite),
      });
      if (!pushRes.ok) throw new Error(`Đẩy dữ liệu thất bại (${pushRes.status})`);

      // Server đã nhận danh sách xoá — bia mộ hết việc.
      clearDeckTombstones(Object.keys(toWrite.deckTombstones));

      lastSyncedAt = Date.now();
      setStatus("idle");
    } catch (err) {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setStatus(
        offline ? "offline" : "error",
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}

/**
 * Đồng bộ ngay, và bảo đảm lượt chạy có nhìn thấy mọi thứ đã ghi tính tới lúc
 * gọi. Chờ được: khi promise này xong thì dữ liệu cục bộ đã lên tới server.
 */
export function syncNow(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const userId = getActiveUserId();
  // Khách không có gì trên server để đồng bộ.
  if (isGuestId(userId)) return Promise.resolve();

  if (!inFlight) {
    inFlight = runSync(userId).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  if (!queued) {
    queued = inFlight
      .catch(() => {})
      .then(() => {
        queued = null;
        return syncNow();
      });
  }
  return queued;
}

/**
 * Khoảng chờ gộp các thay đổi lại. Người dùng lật thẻ liên tục sẽ tạo hàng
 * chục lượt ghi trong vài giây; đẩy từng lượt là phí và dễ bị rate limit.
 */
const DEBOUNCE_MS = 3000;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Hẹn một lượt đồng bộ, gộp mọi lời gọi trong cửa sổ debounce. */
export function scheduleSync(): void {
  if (typeof window === "undefined") return;
  if (isGuestId(getActiveUserId())) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncNow();
  }, DEBOUNCE_MS);
}

/**
 * Xoá toàn bộ dữ liệu học của người dùng hiện tại **trên máy này**.
 *
 * Không đụng tới server. Với khách thì đây là xoá thật; với tài khoản đã đăng
 * nhập thì bản trên server còn nguyên và lượt đồng bộ sau sẽ kéo về lại — nên
 * hộp thoại xác nhận trong `user-menu.tsx` nói rõ hai trường hợp khác nhau.
 */
export function clearAllLocalData(): void {
  if (typeof window === "undefined") return;
  clearLocalCollections(getActiveUserId());
  clearDeckData();
  resetGamification();
  resetPathProgress();
}

/**
 * Bật engine. Gọi một lần từ provider phía client.
 *
 * `path-progress` và `gamification` không tự gọi `scheduleSync()` — làm thế sẽ
 * tạo vòng import (sync đọc chúng, chúng gọi sync). Thay vào đó engine tự đăng
 * ký nghe hai store đó.
 */
export function startSyncEngine(): () => void {
  if (typeof window === "undefined") return () => {};

  const unsubs = [
    subscribePathProgress(() => scheduleSync()),
    subscribeGamification(() => scheduleSync()),
    // Đăng nhập / đăng xuất: kéo ngay dữ liệu của danh tính mới.
    subscribeActiveUser(() => void syncNow()),
  ];

  const onOnline = () => void syncNow();
  const onVisible = () => {
    if (document.visibilityState === "visible") void syncNow();
  };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);

  void syncNow();

  return () => {
    for (const unsub of unsubs) unsub();
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}
