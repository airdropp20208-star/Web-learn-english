// Analyze text — uses dictionary service + CEFR spine + readability (no Gemini for definitions)
// Gemini is used ONLY for summary generation (80% reduction in Gemini usage)

import { NextRequest, NextResponse } from "next/server";
import { getDictionaryEntries } from "@/lib/dictionary";
import { scoreText } from "@/lib/readability";
import { GeminiError, generateSummary } from "@/lib/ai-client";
import type { AnalyzeResponse, CEFRLevel } from "@/lib/types";
import * as fs from "fs";
import * as path from "path";

export const runtime = "nodejs";

// Cache CEFR spine in memory (loaded once per server instance)
let cefrSpineCache: Map<string, { cefr: CEFRLevel; freq: number | null }> | null = null;

function loadCEFRSpine(): Map<string, { cefr: CEFRLevel; freq: number | null }> {
  if (cefrSpineCache) return cefrSpineCache;

  try {
    const filePath = path.join(process.cwd(), "public", "data", "words.json");
    const content = fs.readFileSync(filePath, "utf-8");
    const words = JSON.parse(content) as Array<{
      w: string;
      c: CEFRLevel;
      f: number | null;
    }>;
    cefrSpineCache = new Map();
    for (const w of words) {
      cefrSpineCache.set(w.w, { cefr: w.c, freq: w.f });
    }
    console.log(`[analyze] Loaded CEFR spine: ${cefrSpineCache.size} words`);
    return cefrSpineCache;
  } catch (err) {
    console.error("[analyze] Failed to load CEFR spine:", err);
    return new Map();
  }
}

/**
 * Extract candidate vocabulary words from text.
 * Filters: length > 3, alphabetic, not stop words, present in CEFR spine.
 */
function extractCandidateWords(text: string, maxWords: number = 8): string[] {
  const spine = loadCEFRSpine();
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "must", "can",
    "to", "of", "in", "on", "at", "by", "for", "with", "about", "as",
    "into", "like", "through", "after", "over", "between", "out",
    "against", "during", "without", "before", "under", "around", "among",
    "this", "that", "these", "those", "i", "you", "he", "she", "it",
    "we", "they", "me", "him", "her", "us", "them", "my", "your",
    "his", "its", "our", "their", "what", "which", "who", "when",
    "where", "why", "how", "all", "each", "every", "both", "few",
    "more", "most", "other", "some", "such", "no", "not", "only",
    "own", "same", "so", "than", "too", "very", "just", "now",
  ]);

  // Tokenize: lowercase, split on non-alpha
  const tokens = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Deduplicate, prefer words in CEFR spine
  const unique = Array.from(new Set(tokens));
  const inSpine = unique.filter((w) => spine.has(w));

  // Sort by frequency (most rare first = higher CEFR level or lower frequency)
  // Words NOT in spine (unknown) get highest priority (they're likely difficult)
  const notInSpine = unique.filter((w) => !spine.has(w) && w.length > 4);

  // Combine: prioritize unknown words, then CEFR-spine words sorted by rarity
  const candidates = [...notInSpine, ...inSpine.sort((a, b) => {
    const fa = spine.get(a)?.freq ?? -999;
    const fb = spine.get(b)?.freq ?? -999;
    return fa - fb; // lower freq = rarer = first
  })];

  return candidates.slice(0, maxWords);
}

function findContextSentence(content: string, word: string): string {
  const sentences = content.split(/(?<=[.!?])\s+/);
  const lower = word.toLowerCase();
  const found = sentences.find((s) => s.toLowerCase().includes(lower));
  return found ?? sentences[0] ?? "";
}

function findWordPosition(content: string, word: string): number {
  const idx = content.toLowerCase().indexOf(word.toLowerCase());
  return idx === -1 ? 0 : idx;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body as { text?: string };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'text' field" },
        { status: 400 }
      );
    }

    if (text.length > 20000) {
      return NextResponse.json(
        { error: "Text too long (max 20000 characters)" },
        { status: 400 }
      );
    }

    // 1. Compute readability (client-side library, no API call)
    const readability = scoreText(text);

    // 2. Extract candidate vocabulary words
    const candidateWords = extractCandidateWords(text);

    // 3. Fetch dictionary entries for all candidates (parallel, with cache)
    const dictEntries = await getDictionaryEntries(candidateWords);

    // 4. Build highlighted words array
    const spine = loadCEFRSpine();
    const highlightedWords = candidateWords.map((word) => {
      const entry = dictEntries.get(word.toLowerCase());
      const spineEntry = spine.get(word.toLowerCase());

      const cefrLevel: CEFRLevel = spineEntry?.cefr ?? (readability ? readability.cefrEstimate : "B1");
      const definition = entry?.meanings?.[0]?.definitions?.[0]?.definition ?? "";
      const example = entry?.meanings?.[0]?.definitions?.[0]?.example ?? "";

      return {
        word,
        lemma: word.toLowerCase(),
        position: findWordPosition(text, word),
        cefrLevel,
        definition,
        example,
        contextSentence: findContextSentence(text, word),
        ipa: entry?.ipa ?? null,
        audioUrl: entry?.audioUrl ?? null,
      };
    }).filter((w) => w.definition || w.ipa); // only include words with data

    // 5. Generate title + summary via Gemini (only high-value AI task)
    let title = `Reading ${new Date().toLocaleDateString()}`;
    let summary = `This text is approximately ${readability?.cefrEstimate ?? "B1"} level based on readability scoring.`;
    let cefrLevel: CEFRLevel = readability?.cefrEstimate ?? "B1";

    try {
      const aiResult = await generateSummary(text);
      if (aiResult.title) title = aiResult.title;
      if (aiResult.summary) summary = aiResult.summary;
      if (aiResult.cefrLevel) cefrLevel = aiResult.cefrLevel;
    } catch (err) {
      // Gemini failed — use readability-based defaults
      if (err instanceof GeminiError) {
        console.log("[analyze] Gemini unavailable, using readability-based defaults:", err.code);
      }
    }

    const response: AnalyzeResponse = {
      title,
      cefrLevel,
      summary,
      highlightedWords,
      readability: readability ? {
        fleschKincaid: readability.fleschKincaid,
        fleschReading: readability.fleschReading,
        cefrEstimate: readability.cefrEstimate,
        wordCount: readability.wordCount,
      } : null,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
