// Translation route — uses Google Translate free endpoint (no API key required)
// Falls back to MyMemory API if Google fails
// Returns Vietnamese translation for an English word or short text

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// In-memory cache (per server instance) — translations are stable
const cache = new Map<string, string>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, source = "en", target = "vi" } = body as {
      text?: string;
      source?: string;
      target?: string;
    };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing 'text' field" },
        { status: 400 }
      );
    }

    if (text.length > 1000) {
      return NextResponse.json(
        { error: "Text too long (max 1000 characters)" },
        { status: 400 }
      );
    }

    const cacheKey = `${source}:${target}:${text.toLowerCase().trim()}`;
    if (cache.has(cacheKey)) {
      return NextResponse.json({
        translation: cache.get(cacheKey),
        source: "cache",
      });
    }

    // Try Google Translate free endpoint first (unofficial, no key)
    try {
      const googleRes = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LearnEnglishApp/1.0)",
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (googleRes.ok) {
        const data = await googleRes.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translation = data[0]
            .map((segment: any) => (Array.isArray(segment) && segment[0] ? segment[0] : ""))
            .join("")
            .trim();

          if (translation && translation !== text) {
            cache.set(cacheKey, translation);
            return NextResponse.json({
              translation,
              source: "google",
            });
          }
        }
      }
    } catch (err) {
      console.log("[translate] Google failed, trying MyMemory:", err instanceof Error ? err.message : "unknown");
    }

    // Fallback: MyMemory Translation API (free, 5000 words/day anonymous)
    try {
      const myMemoryRes = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`,
        {
          signal: AbortSignal.timeout(5000),
        }
      );

      if (myMemoryRes.ok) {
        const data = await myMemoryRes.json();
        const translation = data?.responseData?.translatedText;
        if (translation && translation !== text && !translation.includes("MYMEMORY WARNING")) {
          cache.set(cacheKey, translation);
          return NextResponse.json({
            translation,
            source: "mymemory",
          });
        }
      }
    } catch (err) {
      console.log("[translate] MyMemory failed:", err instanceof Error ? err.message : "unknown");
    }

    return NextResponse.json(
      { error: "Translation service unavailable", translation: null },
      { status: 503 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
