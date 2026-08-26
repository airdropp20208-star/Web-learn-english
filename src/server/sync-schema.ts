/**
 * Hình dạng dữ liệu mà `/api/sync` chấp nhận.
 *
 * Đây là ranh giới tin cậy: mọi thứ đi qua đây là do trình duyệt gửi lên và
 * phải được kiểm tra. Đặc biệt **không** có trường `userId` nào ở đây được
 * dùng — server luôn lấy userId từ session. Client có gửi kèm thì cũng bị bỏ
 * và ghi đè, nếu không thì đổi một chuỗi trong request là đọc/ghi được dữ liệu
 * của người khác.
 */

import { z } from "zod";

const cefr = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
const itemType = z.enum(["word", "grammar", "gist"]);
const quizType = z.enum(["mcq", "cloze", "recall"]);

/** Mốc thời gian epoch ms. Chặn số âm và số vô lý để không lệch LWW. */
const epochMs = z.number().int().min(0).max(4102444800000); // tới năm 2100

const isoDate = z.string().min(1).max(64);

/**
 * Giới hạn số bản ghi mỗi lượt đẩy.
 *
 * Không phải con số tuỳ tiện: đồng bộ hiện là toàn ảnh chụp, và Vercel chặn
 * body request ở 4,5 MB. 20.000 thẻ ôn tập đã vượt ngưỡng đó. Chặn sớm ở đây
 * để lỗi là một thông báo rõ ràng chứ không phải một request bị cắt giữa chừng.
 */
export const MAX_RECORDS_PER_COLLECTION = 20000;

function collection<T extends z.ZodTypeAny>(item: T) {
  return z.array(item).max(MAX_RECORDS_PER_COLLECTION);
}

export const fsrsCardSchema = z.object({
  due: isoDate,
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  learning_steps: z.number().int(),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  state: z.number().int().min(0).max(3),
  last_review: isoDate.nullable(),
});

export const textSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(500),
  content: z.string().max(200000),
  cefrLevel: cefr,
  summary: z.string().max(20000).nullish(),
  readability: z
    .object({
      fleschKincaid: z.number(),
      fleschReading: z.number(),
      cefrEstimate: cefr,
      wordCount: z.number().int().min(0),
    })
    .nullish(),
  createdAt: epochMs,
  updatedAt: epochMs,
});

export const memoryItemSchema = z.object({
  id: z.string().min(1).max(64),
  sourceTextId: z.string().min(1).max(64),
  itemType,
  refText: z.string().max(20000),
  cefrLevel: cefr,
  card: fsrsCardSchema,
  createdAt: epochMs,
  updatedAt: epochMs,
});

export const vocabItemSchema = z.object({
  id: z.string().min(1).max(64),
  word: z.string().max(200),
  definition: z.string().max(5000),
  vietnamese: z.string().max(5000).nullish(),
  exampleSentence: z.string().max(5000),
  exampleVietnamese: z.string().max(5000).nullish(),
  contextSentence: z.string().max(20000),
  cefrLevel: cefr,
  ipa: z.string().max(200).nullish(),
  audioUrl: z.string().max(2000).nullish(),
  sourceTextId: z.string().min(1).max(64),
  memoryItemId: z.string().min(1).max(64),
  createdAt: epochMs,
  updatedAt: epochMs,
});

export const quizQuestionSchema = z.object({
  id: z.string().min(1).max(64),
  textId: z.string().min(1).max(64),
  type: quizType,
  question: z.string().max(5000),
  options: z.array(z.string().max(2000)).max(20),
  correctAnswer: z.string().max(2000),
  relatedMemoryItemId: z.string().max(64).nullish(),
  createdAt: epochMs,
});

export const shadowSessionSchema = z.object({
  id: z.string().min(1).max(64),
  textId: z.string().min(1).max(64),
  audioUrl: z.string().max(2000),
  userRecordingUrl: z.string().max(2000),
  completedAt: epochMs,
});

export const userProgressSchema = z.object({
  id: z.string().min(1).max(64),
  currentTier: cefr,
  tierMasteryScore: z.number(),
  streakDays: z.number().int().min(0),
  lastActiveDate: epochMs,
  updatedAt: epochMs,
});

export const pathProgressSchema = z.object({
  completedLessons: z.array(z.string().max(200)).max(2000),
  lessonScores: z.record(z.string().max(200), z.number()),
  learnedWords: z.array(z.string().max(200)).max(20000),
  lastStudiedAt: z.string().max(64).nullable(),
  updatedAt: epochMs,
});

export const gamificationSchema = z.object({
  coins: z.number().int().min(0),
  xp: z.number().int().min(0),
  level: z.number().int().min(1),
  streak: z.number().int().min(0),
  lastStudyDate: z.string().max(32).nullable(),
  todayProgress: z.object({
    date: z.string().max(32),
    wordsLearned: z.number().int().min(0),
    wordsReviewed: z.number().int().min(0),
    gamesPlayed: z.number().int().min(0),
  }),
  achievements: z.array(z.string().max(100)).max(500),
  updatedAt: epochMs,
});

export const deckSubscriptionSchema = z.object({
  deckId: z.string().min(1).max(200),
  subscribedAt: epochMs,
  studiedWords: z.array(z.number().int().min(0)).max(MAX_RECORDS_PER_COLLECTION),
  cardStates: z.record(z.string().max(200), fsrsCardSchema),
  updatedAt: epochMs,
});

export const syncSnapshotSchema = z.object({
  texts: collection(textSchema),
  vocabItems: collection(vocabItemSchema),
  memoryItems: collection(memoryItemSchema),
  quizQuestions: collection(quizQuestionSchema),
  shadowSessions: collection(shadowSessionSchema),
  userProgress: userProgressSchema.nullable(),
  pathProgress: pathProgressSchema.nullable(),
  gamification: gamificationSchema.nullable(),
  deckSubscriptions: z.array(deckSubscriptionSchema).max(1000),
  deckTombstones: z.record(z.string().max(200), epochMs),
});

export type SyncPayload = z.infer<typeof syncSnapshotSchema>;
