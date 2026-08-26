// Deck storage helpers — manage subscribed decks + deck progress
//
// Lưu trong localStorage, phân vùng theo người dùng đang hoạt động.
// Khi đã đăng nhập, src/lib/sync.ts gương dữ liệu này lên server và hoà giải
// theo updatedAt, ở mức từng deck.

import type { FSRSCardState } from "./types";
import {
  readScopedFor,
  readWithLegacyFallback,
  scopedKey,
  writeScopedFor,
} from "./active-user";

export interface DeckSubscription {
  deckId: string;
  subscribedAt: number;
  /** Vị trí của những từ đã học, trỏ vào mảng deck.words */
  studiedWords: number[];
  /** Trạng thái thẻ FSRS theo từng từ: word -> card state */
  cardStates: Record<string, FSRSCardState>;
  /**
   * Mốc ghi lần cuối, epoch ms. Trường quyết định khi hoà giải xung đột giữa
   * máy này và server (last-write-wins, so theo từng deck).
   */
  updatedAt: number;
}

export interface DeckProgress {
  totalWords: number;
  studiedWords: number;
  dueWords: number;
  masteryPercent: number;
}

/** Tiền tố khoá; khoá thật có gắn id người dùng — xem active-user.ts. */
export const SUB_PREFIX = "deck-subscriptions";

/** Khoá của bản cũ, thời chưa phân vùng theo người dùng. */
const LEGACY_SUB_KEY = "deck-subscriptions";

/**
 * Bia mộ cho những deck đã huỷ đăng ký: deckId -> mốc xoá (epoch ms).
 *
 * Không có nó thì huỷ đăng ký không bao giờ đồng bộ được. Đẩy lên server một
 * danh sách thiếu deck X là mơ hồ — server không phân biệt được "vừa xoá X"
 * với "máy này chưa từng biết X", nên nó sẽ gửi X trả lại và deck sống dậy.
 * Bia mộ nói rõ: X đã bị xoá lúc T. Sync xoá bia sau khi server xác nhận.
 */
export const TOMB_PREFIX = "deck-subscriptions-deleted";

function subKey(): string {
  return scopedKey(SUB_PREFIX);
}

function tombKey(): string {
  return scopedKey(TOMB_PREFIX);
}

/** Thẻ được coi là “thuộc” khi khoảng ôn tiếp theo từ 21 ngày trở lên. */
const MASTERED_INTERVAL_DAYS = 21;

function parseSubs(raw: string | null): Record<string, DeckSubscription> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, DeckSubscription>;
    // Bản lưu cũ chưa có updatedAt. Để undefined thì mọi phép so sánh khi hoà
    // giải đều ra NaN và bản ghi không bao giờ thắng — mặc định 0 cho nó thua
    // một cách xác định, đúng ý: dữ liệu chưa từng đồng bộ thì server ưu tiên.
    for (const sub of Object.values(parsed)) {
      if (typeof sub.updatedAt !== "number") sub.updatedAt = 0;
    }
    return parsed;
  } catch {
    return {};
  }
}

function getSubs(): Record<string, DeckSubscription> {
  if (typeof window === "undefined") return {};
  return parseSubs(readWithLegacyFallback(SUB_PREFIX, LEGACY_SUB_KEY));
}

function setSubs(subs: Record<string, DeckSubscription>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(subKey(), JSON.stringify(subs));
  } catch {
    // localStorage đầy hoặc bị chặn
  }
}

/** Đọc bia mộ: deckId -> mốc xoá. */
export function getDeckTombstones(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(tombKey());
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function setTombstones(tombs: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(tombKey(), JSON.stringify(tombs));
  } catch {
    // localStorage đầy hoặc bị chặn
  }
}

/** Xoá các bia mộ mà server đã xác nhận. Dùng bởi src/lib/sync.ts. */
export function clearDeckTombstones(deckIds: string[]): void {
  if (deckIds.length === 0) return;
  const tombs = getDeckTombstones();
  for (const id of deckIds) delete tombs[id];
  setTombstones(tombs);
}

/** Toàn bộ đăng ký deck của người dùng hiện tại. Dùng bởi src/lib/sync.ts. */
export function getAllDeckSubscriptions(): DeckSubscription[] {
  return Object.values(getSubs());
}

/** Đăng ký deck của một người dùng cụ thể, không phụ thuộc ai đang hoạt động. */
export function getDeckSubscriptionsFor(userId: string): DeckSubscription[] {
  if (typeof window === "undefined") return [];
  return Object.values(parseSubs(readScopedFor(SUB_PREFIX, userId)));
}

/** Bia mộ deck của một người dùng cụ thể. */
export function getDeckTombstonesFor(userId: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = readScopedFor(TOMB_PREFIX, userId);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/**
 * Ghi đè toàn bộ đăng ký deck, GIỮ NGUYÊN updatedAt được truyền vào.
 *
 * Chỉ engine đồng bộ mới nên gọi — xem giải thích ở replacePathProgress.
 */
export function replaceDeckSubscriptions(
  userId: string,
  subs: DeckSubscription[]
): void {
  const map: Record<string, DeckSubscription> = {};
  for (const sub of subs) map[sub.deckId] = sub;
  // Ghi theo userId được truyền vào chứ không theo người đang hoạt động: engine
  // đồng bộ gọi hàm này cho một danh tính xác định.
  writeScopedFor(SUB_PREFIX, userId, JSON.stringify(map));
}

/** Xoá đăng ký deck và bia mộ của người dùng hiện tại trên máy này. */
export function clearDeckData(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(subKey());
    localStorage.removeItem(tombKey());
  } catch {
    // localStorage bị chặn
  }
}

/** Một thẻ đến hạn khi chưa ôn lần nào, hoặc đã qua ngày hẹn. */
export function isCardStateDue(
  card: FSRSCardState | undefined,
  now: number = Date.now()
): boolean {
  if (!card) return true;
  if (!card.reps) return true;
  const due = new Date(card.due).getTime();
  if (Number.isNaN(due)) return true;
  return due <= now;
}

export async function getSubscribedDecks(): Promise<string[]> {
  return Object.keys(getSubs());
}

export async function isDeckSubscribed(deckId: string): Promise<boolean> {
  return deckId in getSubs();
}

export async function subscribeToDeck(deckId: string): Promise<void> {
  const subs = getSubs();
  if (!subs[deckId]) {
    subs[deckId] = {
      deckId,
      subscribedAt: Date.now(),
      studiedWords: [],
      cardStates: {},
      updatedAt: Date.now(),
    };
    setSubs(subs);

    // Đăng ký lại thì bia mộ cũ không còn đúng nữa.
    const tombs = getDeckTombstones();
    if (deckId in tombs) {
      delete tombs[deckId];
      setTombstones(tombs);
    }
  }
}

export async function unsubscribeFromDeck(deckId: string): Promise<void> {
  const subs = getSubs();
  delete subs[deckId];
  setSubs(subs);

  const tombs = getDeckTombstones();
  tombs[deckId] = Date.now();
  setTombstones(tombs);
}

export async function getDeckSubscription(
  deckId: string
): Promise<DeckSubscription | null> {
  return getSubs()[deckId] ?? null;
}

/**
 * Đánh dấu một từ đã học + lưu trạng thái thẻ FSRS của nó.
 * Tự đăng ký deck nếu người dùng học thẳng mà chưa subscribe.
 */
export async function markWordStudied(
  deckId: string,
  wordIndex: number,
  word: string,
  cardState: FSRSCardState
): Promise<void> {
  const subs = getSubs();
  if (!subs[deckId]) {
    subs[deckId] = {
      deckId,
      subscribedAt: Date.now(),
      studiedWords: [],
      cardStates: {},
      updatedAt: 0,
    };
  }

  if (!subs[deckId].studiedWords.includes(wordIndex)) {
    subs[deckId].studiedWords.push(wordIndex);
  }
  subs[deckId].cardStates[word] = cardState;
  subs[deckId].updatedAt = Date.now();
  setSubs(subs);
}

/**
 * Trả về vị trí của những từ đã học và đang đến hạn ôn.
 * Cần danh sách từ của deck để ánh xạ vị trí sang từ.
 */
export async function getDueWords(
  deckId: string,
  words: string[]
): Promise<number[]> {
  const sub = getSubs()[deckId];
  if (!sub) return [];

  const now = Date.now();
  return sub.studiedWords.filter((idx) => {
    const word = words[idx];
    if (!word) return false;
    return isCardStateDue(sub.cardStates[word], now);
  });
}

/** Lấy toàn bộ trạng thái thẻ của một deck. */
export async function getDeckCardStates(
  deckId: string
): Promise<Record<string, FSRSCardState>> {
  return getSubs()[deckId]?.cardStates ?? {};
}

/**
 * Tính tiến độ của một deck.
 * - studiedWords: số từ đã học ít nhất một lần
 * - dueWords: số từ đã học và đang đến hạn ôn (không tính từ chưa học)
 * - masteryPercent: tỷ lệ từ đã nhớ vững trên tổng số từ
 */
export async function getDeckProgress(
  deckId: string,
  totalWords: number
): Promise<DeckProgress> {
  const sub = getSubs()[deckId];
  if (!sub) {
    return { totalWords, studiedWords: 0, dueWords: 0, masteryPercent: 0 };
  }

  const now = Date.now();
  const cards = Object.values(sub.cardStates);

  let due = 0;
  let mastered = 0;
  for (const card of cards) {
    if (isCardStateDue(card, now)) due++;
    if (card.scheduled_days >= MASTERED_INTERVAL_DAYS) mastered++;
  }

  return {
    totalWords,
    studiedWords: sub.studiedWords.length,
    dueWords: due,
    masteryPercent:
      totalWords > 0 ? Math.round((mastered / totalWords) * 100) : 0,
  };
}
