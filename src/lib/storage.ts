// Storage helpers — bridge between UI and Prisma
// All functions assume a logged-in user (passed userId)
// "use server" → these become Next server actions, called via RPC from client

"use server";

import { db } from "./db";
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
} from "./types";

// ============ Conversions (Prisma → DTO) ============

function toMemoryItemDTO(raw: any): MemoryItemDTO {
  return {
    id: raw.id,
    userId: raw.userId,
    sourceTextId: raw.sourceTextId,
    itemType: raw.itemType as ItemType,
    refText: raw.refText,
    cefrLevel: raw.cefrLevel as CEFRLevel,
    halfLifeDays: raw.halfLifeDays,
    lastReviewedAt: raw.lastReviewedAt.getTime(),
    correctHistory: JSON.parse(raw.correctHistory || "[]"),
    latencyHistory: JSON.parse(raw.latencyHistory || "[]"),
    createdAt: raw.createdAt.getTime(),
    updatedAt: raw.updatedAt.getTime(),
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
    sourceTextId: raw.sourceTextId,
    memoryItemId: raw.memoryItemId,
    createdAt: raw.createdAt.getTime(),
  };
}

function toTextDTO(raw: any): TextDTO {
  return {
    id: raw.id,
    userId: raw.userId,
    title: raw.title,
    content: raw.content,
    cefrLevel: raw.cefrLevel as CEFRLevel,
    summary: raw.summary,
    createdAt: raw.createdAt.getTime(),
    updatedAt: raw.updatedAt.getTime(),
  };
}

function toQuizQuestionDTO(raw: any): QuizQuestionDTO {
  return {
    id: raw.id,
    userId: raw.userId,
    textId: raw.textId,
    type: raw.type as QuizType,
    question: raw.question,
    options: JSON.parse(raw.options || "[]"),
    correctAnswer: raw.correctAnswer,
    relatedMemoryItemId: raw.relatedMemoryItemId,
    createdAt: raw.createdAt.getTime(),
  };
}

function toUserProgressDTO(raw: any): UserProgressDTO {
  return {
    id: raw.id,
    userId: raw.userId,
    currentTier: raw.currentTier as CEFRLevel,
    tierMasteryScore: raw.tierMasteryScore,
    streakDays: raw.streakDays,
    lastActiveDate: raw.lastActiveDate.getTime(),
  };
}

function toShadowSessionDTO(raw: any): ShadowSessionDTO {
  return {
    id: raw.id,
    userId: raw.userId,
    textId: raw.textId,
    audioUrl: raw.audioUrl,
    userRecordingUrl: raw.userRecordingUrl,
    completedAt: raw.completedAt.getTime(),
  };
}

// ============ Texts ============

export async function createText(
  userId: string,
  data: { title: string; content: string; cefrLevel: CEFRLevel; summary?: string }
): Promise<TextDTO> {
  const text = await db.text.create({
    data: { userId, ...data, summary: data.summary ?? null },
  });
  return toTextDTO(text);
}

export async function getTexts(userId: string): Promise<TextDTO[]> {
  const texts = await db.text.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return texts.map(toTextDTO);
}

export async function getText(userId: string, textId: string): Promise<TextDTO | null> {
  const text = await db.text.findFirst({ where: { id: textId, userId } });
  return text ? toTextDTO(text) : null;
}

// ============ Vocab + Memory Items ============

export async function saveVocabItem(
  userId: string,
  data: {
    word: string;
    definition: string;
    exampleSentence: string;
    contextSentence: string;
    cefrLevel: CEFRLevel;
    sourceTextId: string;
  }
): Promise<{ vocabItem: VocabItemDTO; memoryItem: MemoryItemDTO }> {
  // Create MemoryItem first (halfLifeDays = 1, lastReviewedAt = now)
  const memoryItem = await db.memoryItem.create({
    data: {
      userId,
      sourceTextId: data.sourceTextId,
      itemType: "word",
      refText: data.contextSentence,
      cefrLevel: data.cefrLevel,
      halfLifeDays: 1.0,
      lastReviewedAt: new Date(),
      correctHistory: "[]",
      latencyHistory: "[]",
    },
  });

  const vocabItem = await db.vocabItem.create({
    data: {
      userId,
      word: data.word,
      definition: data.definition,
      exampleSentence: data.exampleSentence,
      contextSentence: data.contextSentence,
      cefrLevel: data.cefrLevel,
      sourceTextId: data.sourceTextId,
      memoryItemId: memoryItem.id,
    },
  });

  return {
    vocabItem: toVocabItemDTO(vocabItem),
    memoryItem: toMemoryItemDTO(memoryItem),
  };
}

export async function getVocabItems(userId: string): Promise<VocabItemDTO[]> {
  const items = await db.vocabItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return items.map(toVocabItemDTO);
}

export async function getMemoryItems(userId: string): Promise<MemoryItemDTO[]> {
  const items = await db.memoryItem.findMany({ where: { userId } });
  return items.map(toMemoryItemDTO);
}

export async function updateMemoryAfterReview(
  memoryItemId: string,
  data: { correct: boolean; latencyMs: number; newHalfLife: number }
): Promise<MemoryItemDTO | null> {
  const existing = await db.memoryItem.findUnique({ where: { id: memoryItemId } });
  if (!existing) return null;

  const correctHistory: boolean[] = JSON.parse(existing.correctHistory || "[]");
  const latencyHistory: number[] = JSON.parse(existing.latencyHistory || "[]");
  correctHistory.push(data.correct);
  latencyHistory.push(data.latencyMs);

  const updated = await db.memoryItem.update({
    where: { id: memoryItemId },
    data: {
      halfLifeDays: data.newHalfLife,
      lastReviewedAt: new Date(),
      correctHistory: JSON.stringify(correctHistory),
      latencyHistory: JSON.stringify(latencyHistory),
    },
  });
  return toMemoryItemDTO(updated);
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
  const created = await db.$transaction(
    questions.map((q) =>
      db.quizQuestion.create({
        data: {
          userId,
          textId,
          type: q.type,
          question: q.question,
          options: JSON.stringify(q.options ?? []),
          correctAnswer: q.correctAnswer,
          relatedMemoryItemId: q.relatedMemoryItemId ?? null,
        },
      })
    )
  );
  return created.map(toQuizQuestionDTO);
}

export async function getQuizQuestions(
  userId: string,
  textId: string
): Promise<QuizQuestionDTO[]> {
  const items = await db.quizQuestion.findMany({
    where: { userId, textId },
    orderBy: { createdAt: "desc" },
  });
  return items.map(toQuizQuestionDTO);
}

// ============ User Progress ============

export async function getUserProgress(
  userId: string
): Promise<UserProgressDTO | null> {
  const progress = await db.userProgress.findUnique({ where: { userId } });
  return progress ? toUserProgressDTO(progress) : null;
}

export async function ensureUserProgress(userId: string): Promise<UserProgressDTO> {
  const existing = await db.userProgress.findUnique({ where: { userId } });
  if (existing) return toUserProgressDTO(existing);
  const created = await db.userProgress.create({
    data: { userId, currentTier: "A2" },
  });
  return toUserProgressDTO(created);
}

export async function updateTierMasteryScore(
  userId: string,
  score: number
): Promise<void> {
  await db.userProgress.update({
    where: { userId },
    data: { tierMasteryScore: score, lastActiveDate: new Date() },
  });
}

export async function advanceTier(userId: string): Promise<UserProgressDTO | null> {
  const progress = await db.userProgress.findUnique({ where: { userId } });
  if (!progress) return null;
  const order: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const idx = order.indexOf(progress.currentTier as CEFRLevel);
  if (idx === -1 || idx === order.length - 1) return toUserProgressDTO(progress);
  const next = order[idx + 1];
  const updated = await db.userProgress.update({
    where: { userId },
    data: { currentTier: next, tierMasteryScore: 0 },
  });
  return toUserProgressDTO(updated);
}

// ============ Shadow Sessions ============

export async function createShadowSession(
  userId: string,
  data: { textId: string; audioUrl?: string; userRecordingUrl?: string }
): Promise<ShadowSessionDTO> {
  const session = await db.shadowSession.create({
    data: {
      userId,
      textId: data.textId,
      audioUrl: data.audioUrl ?? "",
      userRecordingUrl: data.userRecordingUrl ?? "",
    },
  });
  return toShadowSessionDTO(session);
}

export async function getShadowSessions(
  userId: string
): Promise<ShadowSessionDTO[]> {
  const sessions = await db.shadowSession.findMany({
    where: { userId },
    orderBy: { completedAt: "desc" },
  });
  return sessions.map(toShadowSessionDTO);
}
