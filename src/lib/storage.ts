// Storage helpers — localStorage-based with FSRS card state
// Updated to use ts-fsrs for spaced repetition scheduling

import type {
  MemoryItemDTO,
  VocabItemDTO,
  TextDTO,
  QuizQuestionDTO,
  UserProgressDTO,
  ShadowSessionDTO,
  CEFRLevel,
  ItemType,
  QuizType,
  FSRSCardState,
} from "./types";
import {
  createNewCard,
  reviewCard,
  serializeCard,
  deserializeCard,
  type ReviewRating,
} from "./fsrs";

// ============ localStorage helpers ============

function getStore<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStore<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ============ Conversions ============

function toTextDTO(raw: any): TextDTO {
  return {
    id: raw.id,
    userId: raw.userId,
    title: raw.title,
    content: raw.content,
    cefrLevel: raw.cefrLevel as CEFRLevel,
    summary: raw.summary,
    readability: raw.readability ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function toVocabItemDTO(raw: any): VocabItemDTO {
  return {
    id: raw.id,
    userId: raw.userId,
    word: raw.word,
    definition: raw.definition,
    exampleSentence: raw.exampleSentence,
    contextSentence: raw.contextSentence,
    cefrLevel: raw.cefrLevel as CEFRLevel,
    ipa: raw.ipa ?? null,
    audioUrl: raw.audioUrl ?? null,
    sourceTextId: raw.sourceTextId,
    memoryItemId: raw.memoryItemId,
    createdAt: raw.createdAt,
  };
}

function toMemoryItemDTO(raw: any): MemoryItemDTO {
  return {
    id: raw.id,
    userId: raw.userId,
    sourceTextId: raw.sourceTextId,
    itemType: raw.itemType as ItemType,
    refText: raw.refText,
    cefrLevel: raw.cefrLevel as CEFRLevel,
    card: raw.card ?? defaultCardState(),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function defaultCardState(): FSRSCardState {
  try {
    const card = createNewCard();
    return JSON.parse(serializeCard(card));
  } catch (err) {
    // Fallback if ts-fsrs fails in browser (rare, but defensive)
    console.warn("[storage] FSRS card creation failed, using fallback:", err);
    const now = new Date().toISOString();
    return {
      due: now,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      last_review: null,
    };
  }
}

function toQuizQuestionDTO(raw: any): QuizQuestionDTO {
  return {
    id: raw.id,
    userId: raw.userId,
    textId: raw.textId,
    type: raw.type as QuizType,
    question: raw.question,
    options: raw.options ?? [],
    correctAnswer: raw.correctAnswer,
    relatedMemoryItemId: raw.relatedMemoryItemId ?? null,
    createdAt: raw.createdAt,
  };
}

function toUserProgressDTO(raw: any): UserProgressDTO {
  return {
    id: raw.id,
    userId: raw.userId,
    currentTier: raw.currentTier as CEFRLevel,
    tierMasteryScore: raw.tierMasteryScore,
    streakDays: raw.streakDays,
    lastActiveDate: raw.lastActiveDate,
  };
}

function toShadowSessionDTO(raw: any): ShadowSessionDTO {
  return {
    id: raw.id,
    userId: raw.userId,
    textId: raw.textId,
    audioUrl: raw.audioUrl,
    userRecordingUrl: raw.userRecordingUrl,
    completedAt: raw.completedAt,
  };
}

// ============ Texts ============

export async function createText(
  userId: string,
  data: {
    title: string;
    content: string;
    cefrLevel: CEFRLevel;
    summary?: string;
    readability?: TextDTO["readability"];
  }
): Promise<TextDTO> {
  const key = `texts:${userId}`;
  const texts = getStore<any>(key);
  const now = Date.now();
  const text = {
    id: generateId(),
    userId,
    title: data.title,
    content: data.content,
    cefrLevel: data.cefrLevel,
    summary: data.summary ?? null,
    readability: data.readability ?? null,
    createdAt: now,
    updatedAt: now,
  };
  texts.unshift(text);
  setStore(key, texts);
  return toTextDTO(text);
}

export async function getTexts(userId: string): Promise<TextDTO[]> {
  const key = `texts:${userId}`;
  return getStore<any>(key).map(toTextDTO);
}

export async function getText(userId: string, textId: string): Promise<TextDTO | null> {
  const key = `texts:${userId}`;
  const texts = getStore<any>(key);
  const text = texts.find((t: any) => t.id === textId);
  return text ? toTextDTO(text) : null;
}

// ============ Vocab + Memory Items (FSRS) ============

export async function saveVocabItem(
  userId: string,
  data: {
    word: string;
    definition: string;
    exampleSentence: string;
    contextSentence: string;
    cefrLevel: CEFRLevel;
    ipa?: string | null;
    audioUrl?: string | null;
    sourceTextId: string;
  }
): Promise<{ vocabItem: VocabItemDTO; memoryItem: MemoryItemDTO }> {
  const now = Date.now();
  const memoryId = generateId();

  // Create FSRS card (with fallback if ts-fsrs fails in browser)
  const cardState = defaultCardState();

  try {
    // Create memory item with FSRS card state
    const memKey = `memory:${userId}`;
    const memories = getStore<any>(memKey);
    const memoryItem = {
      id: memoryId,
      userId,
      sourceTextId: data.sourceTextId,
      itemType: "word",
      refText: data.contextSentence,
      cefrLevel: data.cefrLevel,
      card: cardState,
      createdAt: now,
      updatedAt: now,
    };
    memories.push(memoryItem);
    setStore(memKey, memories);

    // Create vocab item
    const vocabKey = `vocab:${userId}`;
    const vocabs = getStore<any>(vocabKey);
    const vocabItem = {
      id: generateId(),
      userId,
      word: data.word,
      definition: data.definition,
      exampleSentence: data.exampleSentence,
      contextSentence: data.contextSentence,
      cefrLevel: data.cefrLevel,
      ipa: data.ipa ?? null,
      audioUrl: data.audioUrl ?? null,
      sourceTextId: data.sourceTextId,
      memoryItemId: memoryId,
      createdAt: now,
    };
    vocabs.push(vocabItem);
    setStore(vocabKey, vocabs);

    return {
      vocabItem: toVocabItemDTO(vocabItem),
      memoryItem: toMemoryItemDTO(memoryItem),
    };
  } catch (err) {
    console.error("[storage] saveVocabItem failed:", err);
    throw err;
  }
}

export async function getVocabItems(userId: string): Promise<VocabItemDTO[]> {
  const key = `vocab:${userId}`;
  return getStore<any>(key).map(toVocabItemDTO);
}

export async function getMemoryItems(userId: string): Promise<MemoryItemDTO[]> {
  const key = `memory:${userId}`;
  return getStore<any>(key).map(toMemoryItemDTO);
}

/**
 * Review a memory item using FSRS.
 * Takes a rating (Again/Hard/Good/Easy), updates the FSRS card state.
 */
export async function reviewMemoryItem(
  memoryItemId: string,
  rating: ReviewRating
): Promise<MemoryItemDTO | null> {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith("memory:"));
  for (const key of keys) {
    const memories = getStore<any>(key);
    const idx = memories.findIndex((m: any) => m.id === memoryItemId);
    if (idx !== -1) {
      const item = memories[idx];
      // Deserialize current card, review it, serialize back
      const card = deserializeCard(JSON.stringify(item.card));
      const { card: updatedCard } = reviewCard(card, rating);
      const newCardState = JSON.parse(serializeCard(updatedCard));

      item.card = newCardState;
      item.updatedAt = Date.now();

      memories[idx] = item;
      setStore(key, memories);
      return toMemoryItemDTO(item);
    }
  }
  return null;
}

// ============ Quiz Questions ============

export async function saveQuizQuestions(
  userId: string,
  textId: string,
  questions: Array<{
    type: QuizType;
    question: string;
    options?: string[];
    correctAnswer: string;
    relatedMemoryItemId?: string | null;
  }>
): Promise<QuizQuestionDTO[]> {
  const key = `quizzes:${userId}`;
  const existing = getStore<any>(key);
  const now = Date.now();

  const created = questions.map((q) => ({
    id: generateId(),
    userId,
    textId,
    type: q.type,
    question: q.question,
    options: q.options ?? [],
    correctAnswer: q.correctAnswer,
    relatedMemoryItemId: q.relatedMemoryItemId ?? null,
    createdAt: now,
  }));

  setStore(key, [...created, ...existing]);
  return created.map(toQuizQuestionDTO);
}

export async function getQuizQuestions(
  userId: string,
  textId: string
): Promise<QuizQuestionDTO[]> {
  const key = `quizzes:${userId}`;
  const all = getStore<any>(key);
  return all
    .filter((q: any) => q.textId === textId)
    .map(toQuizQuestionDTO);
}

// ============ User Progress ============

export async function getUserProgress(
  userId: string
): Promise<UserProgressDTO | null> {
  const key = `progress:${userId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return toUserProgressDTO(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function ensureUserProgress(userId: string): Promise<UserProgressDTO> {
  const existing = await getUserProgress(userId);
  if (existing) return existing;

  const now = Date.now();
  const progress = {
    id: generateId(),
    userId,
    currentTier: "A2",
    tierMasteryScore: 0,
    streakDays: 0,
    lastActiveDate: now,
  };
  localStorage.setItem(`progress:${userId}`, JSON.stringify(progress));
  return toUserProgressDTO(progress);
}

export async function updateTierMasteryScore(
  userId: string,
  score: number
): Promise<void> {
  const key = `progress:${userId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return;
  const progress = JSON.parse(raw);
  progress.tierMasteryScore = score;
  progress.lastActiveDate = Date.now();
  localStorage.setItem(key, JSON.stringify(progress));
}

export async function advanceTier(userId: string): Promise<UserProgressDTO | null> {
  const key = `progress:${userId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  const progress = JSON.parse(raw);
  const order: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const idx = order.indexOf(progress.currentTier as CEFRLevel);
  if (idx === -1 || idx === order.length - 1) return toUserProgressDTO(progress);

  progress.currentTier = order[idx + 1];
  progress.tierMasteryScore = 0;
  progress.lastActiveDate = Date.now();
  localStorage.setItem(key, JSON.stringify(progress));
  return toUserProgressDTO(progress);
}

// ============ Shadow Sessions ============

export async function createShadowSession(
  userId: string,
  data: { textId: string; audioUrl?: string; userRecordingUrl?: string }
): Promise<ShadowSessionDTO> {
  const key = `shadows:${userId}`;
  const sessions = getStore<any>(key);
  const session = {
    id: generateId(),
    userId,
    textId: data.textId,
    audioUrl: data.audioUrl ?? "",
    userRecordingUrl: data.userRecordingUrl ?? "",
    completedAt: Date.now(),
  };
  sessions.unshift(session);
  setStore(key, sessions);
  return toShadowSessionDTO(session);
}

export async function getShadowSessions(
  userId: string
): Promise<ShadowSessionDTO[]> {
  const key = `shadows:${userId}`;
  return getStore<any>(key).map(toShadowSessionDTO);
}
