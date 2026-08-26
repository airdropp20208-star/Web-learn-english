/**
 * Facade của tầng lưu trữ.
 *
 * Mọi component nhập từ đây, không nhập thẳng `storage-local`. Phần thân vẫn
 * là localStorage; điều facade thêm vào là: sau mỗi lần ghi, hẹn một lượt đồng
 * bộ lên server (chỉ có tác dụng khi đã đăng nhập — xem `src/lib/sync.ts`).
 *
 * Hàm đọc được xuất lại nguyên vẹn, không bọc gì: bọc chúng chỉ tốn thêm một
 * lớp gọi hàm mà không đổi hành vi.
 *
 * Chữ ký hàm giữ y hệt bản cũ, nên không component nào phải sửa.
 */

import type {
  CEFRLevel,
  MemoryItemDTO,
  QuizQuestionDTO,
  QuizType,
  ShadowSessionDTO,
  TextDTO,
  UserProgressDTO,
  VocabItemDTO,
} from "./types";
import type { ReviewRating } from "./fsrs";
import * as local from "./storage-local";
import { scheduleSync } from "./sync";

// ============ Đọc — xuất lại nguyên vẹn ============

export const getTexts = local.getTexts;
export const getText = local.getText;
export const getVocabItems = local.getVocabItems;
export const getMemoryItems = local.getMemoryItems;
export const getQuizQuestions = local.getQuizQuestions;
export const getUserProgress = local.getUserProgress;
export const getShadowSessions = local.getShadowSessions;

// ============ Ghi — bọc thêm một lượt hẹn đồng bộ ============

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
  const result = await local.createText(userId, data);
  scheduleSync();
  return result;
}

export async function saveVocabItem(
  userId: string,
  data: {
    word: string;
    definition: string;
    vietnamese?: string | null;
    exampleSentence: string;
    exampleVietnamese?: string | null;
    contextSentence: string;
    cefrLevel: CEFRLevel;
    ipa?: string | null;
    audioUrl?: string | null;
    sourceTextId: string;
  }
): Promise<{ vocabItem: VocabItemDTO; memoryItem: MemoryItemDTO }> {
  const result = await local.saveVocabItem(userId, data);
  scheduleSync();
  return result;
}

export async function reviewMemoryItem(
  userId: string,
  memoryItemId: string,
  rating: ReviewRating
): Promise<MemoryItemDTO | null> {
  const result = await local.reviewMemoryItem(userId, memoryItemId, rating);
  scheduleSync();
  return result;
}

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
  const result = await local.saveQuizQuestions(userId, textId, questions);
  scheduleSync();
  return result;
}

export async function ensureUserProgress(userId: string): Promise<UserProgressDTO> {
  const result = await local.ensureUserProgress(userId);
  scheduleSync();
  return result;
}

export async function updateTierMasteryScore(
  userId: string,
  score: number
): Promise<void> {
  await local.updateTierMasteryScore(userId, score);
  scheduleSync();
}

export async function advanceTier(userId: string): Promise<UserProgressDTO | null> {
  const result = await local.advanceTier(userId);
  scheduleSync();
  return result;
}

export async function createShadowSession(
  userId: string,
  data: { textId: string; audioUrl?: string; userRecordingUrl?: string }
): Promise<ShadowSessionDTO> {
  const result = await local.createShadowSession(userId, data);
  scheduleSync();
  return result;
}
