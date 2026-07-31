// Deck storage helpers — manage subscribed decks + deck progress
// Stored in localStorage

export interface DeckSubscription {
  deckId: string;
  subscribedAt: number;
  // Track which words user has studied (by word index in deck)
  studiedWords: number[]; // indices into deck.words array
  // Track FSRS card states per word (keyed by word string)
  cardStates: Record<string, any>; // word -> FSRS card state
}

export interface DeckProgress {
  totalWords: number;
  studiedWords: number;
  dueWords: number;
  masteryPercent: number;
}

const SUB_KEY = "deck-subscriptions";

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
  localStorage.setItem(SUB_KEY, JSON.stringify(subs));
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

export async function getDeckSubscription(deckId: string): Promise<DeckSubscription | null> {
  return getSubs()[deckId] ?? null;
}

/**
 * Mark a word as studied + store its FSRS card state.
 */
export async function markWordStudied(
  deckId: string,
  wordIndex: number,
  word: string,
  cardState: any
): Promise<void> {
  const subs = getSubs();
  if (!subs[deckId]) return;

  if (!subs[deckId].studiedWords.includes(wordIndex)) {
    subs[deckId].studiedWords.push(wordIndex);
  }
  subs[deckId].cardStates[word] = cardState;
  setSubs(subs);
}

/**
 * Get list of words in deck that are due for review (FSRS card.due <= now).
 */
export async function getDueWords(deckId: string): Promise<number[]> {
  const sub = getSubs()[deckId];
  if (!sub) return [];

  const now = Date.now();
  return sub.studiedWords.filter((idx) => {
    // Get word from deck — but we don't have deck data here, just card states
    // Caller needs to map idx -> word -> card state
    return idx; // placeholder, caller will filter
  });
}

/**
 * Get all card states for a deck (for review session).
 */
export async function getDeckCardStates(deckId: string): Promise<Record<string, any>> {
  return getSubs()[deckId]?.cardStates ?? {};
}

/**
 * Compute progress for a deck.
 */
export async function getDeckProgress(
  deckId: string,
  totalWords: number
): Promise<DeckProgress> {
  const sub = getSubs()[deckId];
  if (!sub) {
    return {
      totalWords,
      studiedWords: 0,
      dueWords: 0,
      masteryPercent: 0,
    };
  }

  const studied = sub.studiedWords.length;
  const now = Date.now();
  let due = 0;
  for (const word of Object.keys(sub.cardStates)) {
    const card = sub.cardStates[word];
    if (card?.due) {
      try {
        const dueDate = new Date(card.due).getTime();
        if (dueDate <= now) due++;
      } catch {
        // skip invalid
      }
    } else {
      // New card without due date = due now
      due++;
    }
  }

  return {
    totalWords,
    studiedWords: studied,
    dueWords: due,
    masteryPercent: totalWords > 0 ? Math.round((studied / totalWords) * 100) : 0,
  };
}
