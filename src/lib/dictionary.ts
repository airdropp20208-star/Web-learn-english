// Dictionary service — combines Free Dictionary API + cmu-pronouncing-dictionary (offline)
// Returns: definitions, IPA, audio URL, examples — without calling Gemini

import { dictionary as cmuDict } from "cmu-pronouncing-dictionary";

export interface DictionaryEntry {
  word: string;
  ipa: string | null;
  audioUrl: string | null;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
    }>;
  }>;
  source: "wiktionary" | "offline";
}

// In-memory cache (per server instance)
const cache = new Map<string, DictionaryEntry | null>();

/**
 * Get IPA for a word from offline CMU dictionary (instant, no network).
 */
export function getIPA(word: string): string | null {
  const lower = word.toLowerCase().replace(/[^a-z]/g, "");
  const arpabet = cmuDict[lower];
  if (!arpabet) return null;

  // Convert ARPABET to IPA (simplified)
  const arpabetToIpa: Record<string, string> = {
    AA: "ɑ", AE: "æ", AH: "ʌ", AO: "ɔ", AW: "aʊ", AY: "aɪ",
    EH: "ɛ", ER: "ɝ", EY: "eɪ", IH: "ɪ", IY: "i", OW: "oʊ",
    OY: "ɔɪ", UH: "ʊ", UW: "u",
    B: "b", CH: "tʃ", D: "d", DH: "ð", F: "f", G: "ɡ",
    HH: "h", JH: "dʒ", K: "k", L: "l", M: "m", N: "n", NG: "ŋ",
    P: "p", R: "r", S: "s", SH: "ʃ", T: "t", TH: "θ", V: "v",
    W: "w", Y: "j", Z: "z", ZH: "ʒ",
  };

  const phonemes = arpabet.split(" ");
  const ipaParts: string[] = [];
  for (const p of phonemes) {
    const stress = p.match(/(\d)$/);
    const base = p.replace(/\d$/, "");
    const ipa = arpabetToIpa[base];
    if (ipa) {
      ipaParts.push(ipa);
      if (stress && stress[1] === "1") {
        ipaParts.push("ˈ");
      }
    }
  }
  return ipaParts.length > 0 ? `/${ipaParts.join("")}/` : null;
}

/**
 * Fetch full dictionary entry from Free Dictionary API (Wiktionary-backed).
 * Falls back to offline IPA-only entry if API fails.
 */
export async function getDictionaryEntry(
  word: string
): Promise<DictionaryEntry | null> {
  const lower = word.toLowerCase().trim();

  if (cache.has(lower)) {
    return cache.get(lower) ?? null;
  }

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lower)}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) {
      // API returned error — fall back to offline
      const offline = buildOfflineEntry(lower);
      cache.set(lower, offline);
      return offline;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      const offline = buildOfflineEntry(lower);
      cache.set(lower, offline);
      return offline;
    }

    const entry = data[0];
    const apiIpa = entry.phonetic || entry.phonetics?.find((p: any) => p.text)?.text || null;
    const audioUrl = entry.phonetics?.find((p: any) => p.audio)?.audio || null;

    const meanings = (entry.meanings || []).map((m: any) => ({
      partOfSpeech: m.partOfSpeech || "",
      definitions: (m.definitions || []).map((d: any) => ({
        definition: d.definition || "",
        example: d.example,
      })),
    }));

    // Prefer API IPA, fall back to offline CMU
    const ipa = apiIpa || getIPA(lower);

    const result: DictionaryEntry = {
      word: entry.word || lower,
      ipa,
      audioUrl: audioUrl || null,
      meanings,
      source: "wiktionary",
    };

    cache.set(lower, result);
    return result;
  } catch (err) {
    // Network error or timeout — fall back to offline
    const offline = buildOfflineEntry(lower);
    cache.set(lower, offline);
    return offline;
  }
}

function buildOfflineEntry(word: string): DictionaryEntry {
  return {
    word,
    ipa: getIPA(word),
    audioUrl: null,
    meanings: [],
    source: "offline",
  };
}

/**
 * Batch fetch dictionary entries (with concurrency limit).
 */
export async function getDictionaryEntries(
  words: string[]
): Promise<Map<string, DictionaryEntry | null>> {
  const result = new Map<string, DictionaryEntry | null>();
  const concurrency = 5;
  const queue = [...words];

  async function worker() {
    while (queue.length > 0) {
      const word = queue.shift();
      if (!word) break;
      const entry = await getDictionaryEntry(word);
      result.set(word.toLowerCase(), entry);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, words.length) }, () => worker());
  await Promise.all(workers);
  return result;
}
