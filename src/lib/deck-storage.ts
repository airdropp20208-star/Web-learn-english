/**
 * Facade của kho đăng ký deck. Xem `src/lib/storage.ts` để biết vì sao có lớp
 * này: đọc xuất lại nguyên vẹn, ghi thì bọc thêm một lượt hẹn đồng bộ.
 */

import type { FSRSCardState } from "./types";
import * as local from "./deck-storage-local";
import { scheduleSync } from "./sync";

export type { DeckSubscription, DeckProgress } from "./deck-storage-local";

// ============ Đọc + hàm thuần — xuất lại nguyên vẹn ============

export const isCardStateDue = local.isCardStateDue;
export const getSubscribedDecks = local.getSubscribedDecks;
export const isDeckSubscribed = local.isDeckSubscribed;
export const getDeckSubscription = local.getDeckSubscription;
export const getDueWords = local.getDueWords;
export const getDeckCardStates = local.getDeckCardStates;
export const getDeckProgress = local.getDeckProgress;

// ============ Ghi — bọc thêm một lượt hẹn đồng bộ ============

export async function subscribeToDeck(deckId: string): Promise<void> {
  await local.subscribeToDeck(deckId);
  scheduleSync();
}

export async function unsubscribeFromDeck(deckId: string): Promise<void> {
  await local.unsubscribeFromDeck(deckId);
  scheduleSync();
}

export async function markWordStudied(
  deckId: string,
  wordIndex: number,
  word: string,
  cardState: FSRSCardState
): Promise<void> {
  await local.markWordStudied(deckId, wordIndex, word, cardState);
  scheduleSync();
}
