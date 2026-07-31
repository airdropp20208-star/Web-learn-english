// Readability scoring — browser-side CEFR estimation using text-readability
// No API call needed, instant results

import * as readability from "text-readability";
import type { CEFRLevel } from "./types";

export interface ReadabilityScore {
  fleschKincaid: number; // Grade level (1-12+)
  fleschReading: number; // Flesch Reading Ease (0-100, higher = easier)
  smog: number; // SMOG index
  ari: number; // Automated Readability Index
  cefrEstimate: CEFRLevel;
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
}

/**
 * Estimate CEFR level from Flesch-Kincaid grade.
 * Mapping is approximate, based on common ESL correlations:
 * - FK 1-3 → A1
 * - FK 4-5 → A2
 * - FK 6-7 → B1
 * - FK 8-9 → B2
 * - FK 10-11 → C1
 * - FK 12+ → C2
 */
export function fkToCEFR(fk: number): CEFRLevel {
  if (fk <= 3) return "A1";
  if (fk <= 5) return "A2";
  if (fk <= 7) return "B1";
  if (fk <= 9) return "B2";
  if (fk <= 11) return "C1";
  return "C2";
}

/**
 * Compute readability scores for a text.
 * Returns null if text is too short to score meaningfully.
 */
export function scoreText(text: string): ReadabilityScore | null {
  if (!text || text.trim().length < 20) return null;

  const wordCount = countWords(text);
  const sentenceCount = countSentences(text);
  if (wordCount < 10 || sentenceCount === 0) return null;

  let fleschKincaid = 0;
  let fleschReading = 100;
  let smog = 0;
  let ari = 0;

  try {
    fleschKincaid = readability.fleschKincaidGrade(text) || 0;
    fleschReading = readability.fleschReadingEase(text) || 100;
    smog = readability.smogIndex(text) || 0;
    ari = readability.automatedReadabilityIndex(text) || 0;
  } catch {
    // Fall through with defaults
  }

  // Clamp FK to reasonable range
  const fkClamped = Math.max(1, Math.min(20, fleschKincaid));

  return {
    fleschKincaid: fkClamped,
    fleschReading: Math.max(0, Math.min(100, fleschReading)),
    smog: Math.max(0, smog),
    ari: Math.max(0, ari),
    cefrEstimate: fkToCEFR(fkClamped),
    wordCount,
    sentenceCount,
    avgWordsPerSentence: wordCount / sentenceCount,
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g);
  return matches ? matches.length : 1;
}
