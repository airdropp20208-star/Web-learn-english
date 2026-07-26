// Content Curation — rank word relevance
// Higher score = more worth learning

import type { TextDTO } from "./types";

// Mock CEFR frequency map (subset) — Phase 3 sẽ thay bằng real dataset
// Score 1-10, 10 = most common in English
const CORPUS_FREQ_MOCK: Record<string, number> = {
  the: 10, be: 10, to: 10, of: 10, and: 10, a: 10, in: 10, that: 9,
  have: 9, i: 9, it: 9, for: 9, not: 9, on: 9, with: 8, he: 8, as: 8,
  you: 8, do: 8, at: 8, this: 8, but: 8, his: 8, by: 8, from: 8,
  they: 7, we: 7, say: 7, her: 7, she: 7, or: 7, an: 7, will: 7,
  my: 7, one: 7, all: 7, would: 7, there: 7, their: 7, what: 7,
  // ... hundreds more would go here for real CEFR ranking
};

export function getCEFRFrequency(word: string): number {
  const lower = word.toLowerCase();
  return CORPUS_FREQ_MOCK[lower] ?? 3; // default 3/10 for unknown words
}

/**
 * Count occurrences of word in user's reading history.
 */
export function countOccurrences(word: string, history: TextDTO[]): number {
  const lower = word.toLowerCase();
  let count = 0;
  for (const text of history) {
    const tokens = text.content.toLowerCase().split(/\W+/);
    count += tokens.filter((t) => t === lower).length;
  }
  return count;
}

/**
 * Rank word relevance: combine corpus freq + personal freq.
 * Per brief: personalFreq > 0 ? personalFreq * 2 + corpusFreq : corpusFreq
 */
export function rankWordRelevance(
  word: string,
  userHistory: TextDTO[]
): number {
  const corpusFreq = getCEFRFrequency(word);
  const personalFreq = countOccurrences(word, userHistory);
  return personalFreq > 0 ? personalFreq * 2 + corpusFreq : corpusFreq;
}

/**
 * Pick top-N worth-learning words from a content string.
 */
export function pickTopWords(
  content: string,
  userHistory: TextDTO[],
  topN: number = 8
): Array<{ word: string; score: number }> {
  const tokens = Array.from(
    new Set(content.toLowerCase().split(/\W+/).filter((t) => t.length > 2))
  );

  return tokens
    .map((word) => ({ word, score: rankWordRelevance(word, userHistory) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
