// Domain types — updated for FSRS-based memory model

export type ItemType = "word" | "grammar" | "gist";
export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type QuizType = "mcq" | "cloze" | "recall";

// FSRS card state (serialized for localStorage)
export interface FSRSCardState {
  due: string;          // ISO date
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;        // 0=New, 1=Learning, 2=Review, 3=Relearning
  last_review: string | null; // ISO date
}

export interface MemoryItemDTO {
  id: string;
  userId: string;
  sourceTextId: string;
  itemType: ItemType;
  refText: string;
  cefrLevel: CEFRLevel;
  // FSRS card state (replaces halfLifeDays, correctHistory, latencyHistory)
  card: FSRSCardState;
  createdAt: number;
  updatedAt: number;
}

export interface VocabItemDTO {
  id: string;
  userId: string;
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
  // Readability scores (computed client-side, no Gemini needed)
  readability?: {
    fleschKincaid: number;
    fleschReading: number;
    cefrEstimate: CEFRLevel;
    wordCount: number;
  } | null;
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
  // Now includes IPA + audio from dictionary service (not Gemini)
  highlightedWords: Array<{
    word: string;
    lemma: string;
    position: number;
    cefrLevel: CEFRLevel;
    definition: string;
    example: string;
    contextSentence: string;
    ipa: string | null;
    audioUrl: string | null;
  }>;
  // Client-side readability score (not from Gemini)
  readability: {
    fleschKincaid: number;
    fleschReading: number;
    cefrEstimate: CEFRLevel;
    wordCount: number;
  } | null;
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

// Grammar check response (LanguageTool)
export interface GrammarCheckResponse {
  matches: Array<{
    message: string;
    shortMessage?: string;
    offset: number;
    length: number;
    rule: {
      id: string;
      description: string;
      category: { id: string; name: string };
    };
    replacements: Array<{ value: string }>;
  }>;
}
