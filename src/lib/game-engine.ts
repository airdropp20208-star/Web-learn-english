// Lõi chung cho các mini-game: sinh câu hỏi từ bộ từ và ghi kết quả vào FSRS.
// Mục tiêu: chơi game cũng là học thật, không phải chơi cho vui rồi mất trắng.

import type { FSRSCardState } from "./types";
import {
  createNewCard,
  reviewCard,
  serializeCard,
  deserializeCard,
  type ReviewRating,
} from "./fsrs";
import { markWordStudied, isCardStateDue } from "./deck-storage";

export interface GameWord {
  /** Vị trí trong mảng deck.words — cần để ghi tiến độ */
  index: number;
  word: string;
  definition?: string;
  vietnamese?: string;
  example?: string;
  exampleVietnamese?: string;
  ipa?: string;
  audioUrl?: string;
}

export type QuestionKind =
  | "meaning-to-word"
  | "word-to-meaning"
  | "listen"
  | "spell";

export interface GameQuestion {
  id: string;
  kind: QuestionKind;
  target: GameWord;
  /** Đề bài hiển thị (rỗng với câu nghe) */
  prompt: string;
  /** Rỗng với câu đánh vần */
  options: string[];
  answer: string;
}

const OPTION_MAX_LENGTH = 70;

export function meaningOf(word: GameWord): string | null {
  const meaning = word.vietnamese?.trim() || word.definition?.trim();
  return meaning ? meaning : null;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function truncate(text: string): string {
  return text.length > OPTION_MAX_LENGTH
    ? `${text.slice(0, OPTION_MAX_LENGTH)}…`
    : text;
}

/**
 * Chọn từ cho một ván chơi.
 * Thứ tự ưu tiên: từ đến hạn ôn → từ chưa học bao giờ → từ còn lại.
 * Nhờ vậy chơi game cũng đúng lịch ôn chứ không bốc bừa.
 */
export function pickWords(
  words: GameWord[],
  states: Record<string, FSRSCardState>,
  count: number
): GameWord[] {
  const now = Date.now();
  const due: GameWord[] = [];
  const fresh: GameWord[] = [];
  const rest: GameWord[] = [];

  for (const word of words) {
    const state = states[word.word];
    if (!state) fresh.push(word);
    else if (isCardStateDue(state, now)) due.push(word);
    else rest.push(word);
  }

  const ordered = [...shuffle(due), ...shuffle(fresh), ...shuffle(rest)];
  return shuffle(ordered.slice(0, count));
}

/** Trả về null nếu bộ từ không đủ dữ liệu cho kiểu câu hỏi này. */
export function buildQuestion(
  target: GameWord,
  pool: GameWord[],
  kind: QuestionKind
): GameQuestion | null {
  const meaning = meaningOf(target);
  const others = pool.filter((w) => w.index !== target.index);

  if (kind === "spell") {
    if (!meaning) return null;
    return {
      id: `spell-${target.index}`,
      kind,
      target,
      prompt: meaning,
      options: [],
      answer: target.word,
    };
  }

  if (kind === "listen") {
    const distractors = shuffle(others).slice(0, 3).map((w) => w.word);
    if (distractors.length < 3) return null;
    return {
      id: `listen-${target.index}`,
      kind,
      target,
      prompt: "",
      options: shuffle([target.word, ...distractors]),
      answer: target.word,
    };
  }

  if (!meaning) return null;

  if (kind === "word-to-meaning") {
    const pickedMeanings: string[] = [];
    for (const other of shuffle(others)) {
      const otherMeaning = meaningOf(other);
      if (!otherMeaning || otherMeaning === meaning) continue;
      const short = truncate(otherMeaning);
      if (pickedMeanings.includes(short)) continue;
      pickedMeanings.push(short);
      if (pickedMeanings.length === 3) break;
    }
    if (pickedMeanings.length < 3) return null;
    const answer = truncate(meaning);
    if (pickedMeanings.includes(answer)) return null;
    return {
      id: `w2m-${target.index}`,
      kind,
      target,
      prompt: target.word,
      options: shuffle([answer, ...pickedMeanings]),
      answer,
    };
  }

  const distractors = shuffle(others).slice(0, 3).map((w) => w.word);
  if (distractors.length < 3) return null;
  return {
    id: `m2w-${target.index}`,
    kind,
    target,
    prompt: meaning,
    options: shuffle([target.word, ...distractors]),
    answer: target.word,
  };
}

/**
 * Sinh bộ câu hỏi cho một ván. Mỗi từ được thử lần lượt các kiểu câu hỏi
 * cho tới khi tìm được kiểu mà dữ liệu đủ để dựng.
 */
export function buildQuestions(
  words: GameWord[],
  states: Record<string, FSRSCardState>,
  count: number,
  allowedKinds: QuestionKind[] = [
    "meaning-to-word",
    "word-to-meaning",
    "listen",
    "spell",
  ]
): GameQuestion[] {
  const picked = pickWords(words, states, count);
  const questions: GameQuestion[] = [];

  picked.forEach((target, position) => {
    for (const kind of shuffle(allowedKinds)) {
      const question = buildQuestion(target, words, kind);
      if (question) {
        questions.push({ ...question, id: `${question.id}-${position}` });
        return;
      }
    }
  });

  return questions;
}

/**
 * Ghi kết quả một câu trả lời vào lịch ôn FSRS của bộ từ.
 * Đúng = Good (4), sai = Again (2).
 */
export async function recordAnswer(
  deckId: string,
  word: GameWord,
  correct: boolean,
  previous?: FSRSCardState
): Promise<FSRSCardState> {
  const card = previous
    ? deserializeCard(JSON.stringify(previous))
    : createNewCard();
  const rating: ReviewRating = correct ? 4 : 2;
  const { card: updated } = reviewCard(card, rating);
  const next: FSRSCardState = JSON.parse(serializeCard(updated));
  await markWordStudied(deckId, word.index, word.word, next);
  return next;
}

/** Trả lời đúng liên tiếp càng nhiều thì sát thương càng cao. */
export function comboMultiplier(combo: number): number {
  if (combo >= 10) return 3;
  if (combo >= 5) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}

/** So khớp đáp án gõ tay, bỏ qua hoa thường và khoảng trắng thừa. */
export function isTypedAnswerCorrect(input: string, answer: string): boolean {
  return input.trim().toLowerCase() === answer.trim().toLowerCase();
}

export function speakWord(word: GameWord): void {
  if (typeof window === "undefined") return;
  if (word.audioUrl) {
    new Audio(word.audioUrl).play().catch(() => speakFallback(word.word));
    return;
  }
  speakFallback(word.word);
}

function speakFallback(text: string): void {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
