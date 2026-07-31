// AI client — Gemini 2.5 Flash with multi-key rotation
// Reads GEMINI_API_KEYS env var (comma-separated) for rotation on rate limit
// Hard fails when no keys configured → API routes return 503

import { GoogleGenAI, Type } from "@google/genai";
import type { AnalyzeResponse, QuizResponse, CEFRLevel } from "./types";

// ============ Key management ============

interface KeyState {
  keys: string[];
  currentIndex: number;
  disabledUntil: number[]; // epoch ms per key; 0 = available
}

let keyState: KeyState | null = null;

function loadKeys(): KeyState {
  if (keyState) return keyState;
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const keys = raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  keyState = {
    keys,
    currentIndex: 0,
    disabledUntil: new Array(keys.length).fill(0),
  };
  return keyState;
}

export function isGeminiConfigured(): boolean {
  return loadKeys().keys.length > 0;
}

function getActiveClient(): { client: GoogleGenAI; keyIndex: number } | null {
  const state = loadKeys();
  if (state.keys.length === 0) return null;

  const now = Date.now();
  // Find first available key (not disabled)
  for (let i = 0; i < state.keys.length; i++) {
    const idx = (state.currentIndex + i) % state.keys.length;
    if (state.disabledUntil[idx] <= now) {
      state.currentIndex = idx;
      return {
        client: new GoogleGenAI({ apiKey: state.keys[idx] }),
        keyIndex: idx,
      };
    }
  }
  // All keys disabled — throw with shortest cooldown
  const minCooldown = Math.min(...state.disabledUntil) - now;
  throw new GeminiError(
    `All API keys rate-limited. Retry in ${Math.ceil(minCooldown / 1000)}s.`,
    "RATE_LIMITED",
    429
  );
}

function disableKey(keyIndex: number, durationMs: number) {
  const state = loadKeys();
  if (state.disabledUntil[keyIndex] !== undefined) {
    state.disabledUntil[keyIndex] = Date.now() + durationMs;
  }
}

// ============ Error class ============

export class GeminiError extends Error {
  code: string;
  statusCode: number;
  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ============ Model config ============

// Gemini 2.5 Flash — latest + most optimized for text tasks at free tier
const MODEL_ID = "gemini-2.5-flash";

// ============ Core call with rotation ============

interface CallOptions {
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: "application/json" | "text/plain";
  responseSchema?: unknown;
  maxRetries?: number;
}

async function callGemini(opts: CallOptions): Promise<string> {
  const maxRetries = opts.maxRetries ?? loadKeys().keys.length;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const active = getActiveClient();
    if (!active) {
      throw new GeminiError(
        "Gemini API keys not configured. Set GEMINI_API_KEYS environment variable (comma-separated for rotation).",
        "NOT_CONFIGURED",
        503
      );
    }

    try {
      const response = await active.client.models.generateContent({
        model: MODEL_ID,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.systemInstruction,
          responseMimeType: opts.responseMimeType ?? "application/json",
          responseSchema: opts.responseSchema,
          temperature: 0.7,
        },
      });
      return response.text ?? "";
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();

      // Rate limit → disable key 60s, rotate to next
      if (msg.includes("429") || msg.includes("rate limit") || msg.includes("resource_exhausted")) {
        disableKey(active.keyIndex, 60_000); // 60s cooldown
        continue;
      }
      // Invalid key → disable 5 min, rotate
      if (msg.includes("401") || msg.includes("403") || msg.includes("invalid_api_key") || msg.includes("permission_denied")) {
        disableKey(active.keyIndex, 300_000); // 5 min cooldown
        continue;
      }
      // Other errors → don't retry
      throw new GeminiError(
        `Gemini API error: ${lastError.message}`,
        "API_ERROR",
        500
      );
    }
  }

  throw new GeminiError(
    `Gemini API failed after ${maxRetries} attempts. Last error: ${lastError?.message ?? "unknown"}`,
    "MAX_RETRIES",
    503
  );
}

// ============ Public: analyze text ============

const ANALYZE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title (max 80 chars) summarizing the text" },
    cefrLevel: {
      type: Type.STRING,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      description: "Estimated CEFR difficulty level",
    },
    summary: { type: Type.STRING, description: "1-2 sentence summary of the text" },
    highlightedWords: {
      type: Type.ARRAY,
      description: "3-8 vocabulary words worth learning from this text",
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          definition: { type: Type.STRING, description: "Concise definition matching how the word is used in context" },
          example: { type: Type.STRING, description: "A different example sentence using the word" },
          cefrLevel: {
            type: Type.STRING,
            enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
          },
        },
        required: ["word", "definition", "example", "cefrLevel"],
      },
    },
  },
  required: ["title", "cefrLevel", "summary", "highlightedWords"],
};

export async function analyzeText(content: string): Promise<AnalyzeResponse> {
  const prompt = `Analyze the following English text for a language learner.\n\nText:\n"""\n${content}\n"""\n\nExtract 3-8 vocabulary words that are worth learning (skip trivial words like "the", "and"). For each word, provide a definition matching its usage in context, a different example sentence, and its CEFR level. Also estimate the overall CEFR level of the text and provide a short title and summary.`;

  const raw = await callGemini({
    prompt,
    systemInstruction:
      "You are an English language teacher. You help learners by extracting vocabulary from texts and providing clear, accurate definitions. Always respond in valid JSON matching the requested schema.",
    responseMimeType: "application/json",
    responseSchema: ANALYZE_SCHEMA,
  });

  const parsed = JSON.parse(raw) as {
    title: string;
    cefrLevel: CEFRLevel;
    summary: string;
    highlightedWords: Array<{
      word: string;
      definition: string;
      example: string;
      cefrLevel: CEFRLevel;
    }>;
  };

  // Build full response with position + contextSentence
  const highlightedWords = parsed.highlightedWords.map((w) => {
    const lowerContent = content.toLowerCase();
    const lowerWord = w.word.toLowerCase();
    const position = lowerContent.indexOf(lowerWord);
    const safePosition = position === -1 ? 0 : position;

    // Find context sentence
    const sentences = content.split(/(?<=[.!?])\s+/);
    const contextSentence =
      sentences.find((s) => s.toLowerCase().includes(lowerWord)) ?? sentences[0] ?? "";

    return {
      word: w.word,
      lemma: w.word.toLowerCase(),
      position: safePosition,
      cefrLevel: w.cefrLevel,
      definition: w.definition,
      example: w.example,
      contextSentence,
    };
  });

  return {
    title: parsed.title,
    cefrLevel: parsed.cefrLevel,
    summary: parsed.summary,
    highlightedWords,
  };
}

// ============ Public: generate summary (title + summary + CEFR) ============
// This is the ONLY Gemini call in the analyze flow — reduces Gemini usage by 80%
// Definitions, IPA, audio come from dictionary service; CEFR spine from static dataset

const SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Short title (max 80 chars) summarizing the text" },
    cefrLevel: {
      type: Type.STRING,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
      description: "Estimated CEFR difficulty level",
    },
    summary: { type: Type.STRING, description: "1-2 sentence summary of the text" },
  },
  required: ["title", "cefrLevel", "summary"],
};

export async function generateSummary(
  content: string
): Promise<{ title: string; cefrLevel: CEFRLevel; summary: string }> {
  const prompt = `Read the following English text and provide:\n1. A short title (max 80 characters)\n2. The estimated CEFR level (A1-C2)\n3. A 1-2 sentence summary\n\nText:\n"""\n${content}\n"""`;

  const raw = await callGemini({
    prompt,
    systemInstruction:
      "You are an English language teacher. Provide concise titles and summaries. Always respond in valid JSON matching the requested schema.",
    responseMimeType: "application/json",
    responseSchema: SUMMARY_SCHEMA,
  });

  return JSON.parse(raw);
}

// ============ Public: generate quiz ============

const QUIZ_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      description: "Mixed-format quiz questions",
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: ["mcq", "cloze", "recall"],
            description: "Question format",
          },
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "MCQ options (required for type=mcq, omit otherwise)",
          },
          correctAnswer: { type: Type.STRING },
          relatedWord: {
            type: Type.STRING,
            description: "The vocabulary word this question tests (for memory model update)",
          },
        },
        required: ["type", "question", "correctAnswer"],
      },
    },
  },
  required: ["questions"],
};

export async function generateQuiz(
  _textId: string,
  text: string,
  vocabList: Array<{ word: string; definition: string; contextSentence: string }>
): Promise<QuizResponse> {
  const vocabContext = vocabList.length > 0
    ? `\n\nVocabulary words the user has saved from this text (use these for cloze and recall questions):\n${vocabList.map(v => `- ${v.word}: ${v.definition} (context: "${v.contextSentence}")`).join("\n")}`
    : "";

  const prompt = `Generate a mixed-format reading comprehension quiz for the following English text.\n\nText:\n"""\n${text}\n"""\n\nRequirements:\n- Exactly 1 gist question (main idea) in MCQ format with 4 options\n- 2-3 cloze questions using ACTUAL sentences from the text with the target word removed (replace with _____)\n- 1 recall question asking the user to type the word matching a definition\n- Total: 4-5 questions\n- For cloze and recall questions, include "relatedWord" so we can update the user's memory model\n- correctAnswer for cloze = the original word; for recall = the target word; for mcq = the exact correct option text${vocabContext}`;

  const raw = await callGemini({
    prompt,
    systemInstruction:
      "You are an English language teacher creating quizzes. Mix question types (mcq, cloze, recall) to keep learning engaging. Always respond in valid JSON matching the requested schema.",
    responseMimeType: "application/json",
    responseSchema: QUIZ_SCHEMA,
  });

  const parsed = JSON.parse(raw) as QuizResponse;
  return parsed;
}
