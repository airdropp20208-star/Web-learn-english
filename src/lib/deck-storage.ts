// Deck storage helpers — manage subscribed decks + deck progress
// Lưu trong localStorage.

import type { FSRSCardState } from "./types";

export interface DeckSubscription {
  deckId: string;
  subscribedAt: number;
  /** Vị trí của những từ đã học, trỏ vào mảng deck.words */
  studiedWords: number[];
  /** Trạng thái thẻ FSRS theo từng từ: word -> card state */
  cardStates: Record<string, FSRSCardState>;
}

export interface DeckProgress {
  totalWords: number;
  studiedWords: number;
  dueWords: number;
  masteryPercent: number;
}

const SUB_KEY = "deck-subscriptions";

/** Thẻ được coi là “thuộc” khi khoảng ôn tiếp theo từ 21 ngày trở lên. */
const MASTERED_INTERVAL_DAYS = 21;

function getSubs(): Record<string, DeckSubscription> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SUB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setSubs(subs: Record<string, DeckSubscription>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SUB_KEY, JSON.stringify(subs));
  } catch {
    // localStorage đầy hoặc bị chặn
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
    };
    setSubs(subs);
  }
}

export async function unsubscribeFromDeck(deckId: string): Promise<void> {
  const subs = getSubs();
  delete subs[deckId];
  setSubs(subs);
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
    };
  }

  if (!subs[deckId].studiedWords.includes(wordIndex)) {
    subs[deckId].studiedWords.push(wordIndex);
  }
  subs[deckId].cardStates[word] = cardState;
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
