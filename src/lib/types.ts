// TypeScript domain types matching Prisma models
// Used across client/server for type-safety

export type ItemType = "word" | "grammar" | "gist";
export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type QuizType = "mcq" | "cloze" | "recall";

export interface MemoryItemDTO {
  id: string;
  userId: string;
  sourceTextId: string;
  itemType: ItemType;
  refText: string;
  cefrLevel: CEFRLevel;
  halfLifeDays: number;
  lastReviewedAt: number; // epoch ms
  correctHistory: boolean[];
  latencyHistory: number[];
  createdAt: number;
  updatedAt: number;
}

export interface VocabItemDTO {
  id: string;
  userId: string;
  word: string;
  definition: string;
  exampleSentence: string;
  contextSentence: string;
  cefrLevel: CEFRLevel;
  sourceTextId: string;
  memoryItemId: string;
  createdAt: number;
}

export interface TextDTO {
  id: string;
  userId: string;
  title: string;
  content: string;
  cefrLevel: CEFRLevel;
  summary?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface QuizQuestionDTO {
  id: string;
  userId: string;
  textId: string;
  type: QuizType;
  question: string;
  options: string[];
  correctAnswer: string;
  relatedMemoryItemId?: string | null;
  createdAt: number;
}

export interface UserProgressDTO {
  id: string;
  userId: string;
  currentTier: CEFRLevel;
  tierMasteryScore: number;
  streakDays: number;
  lastActiveDate: number;
}

export interface ShadowSessionDTO {
  id: string;
  userId: string;
  textId: string;
  audioUrl: string;
  userRecordingUrl: string;
  completedAt: number;
}

export interface AnalyzeResponse {
  title: string;
  cefrLevel: CEFRLevel;
  summary: string;
  highlightedWords: Array<{
    word: string;
    lemma: string;
    position: number;
    cefrLevel: CEFRLevel;
    definition: string;
    example: string;
    contextSentence: string;
  }>;
}

export interface QuizResponse {
  questions: Array<{
    type: QuizType;
    question: string;
    options?: string[];
    correctAnswer: string;
    relatedWord?: string;
  }>;
}
