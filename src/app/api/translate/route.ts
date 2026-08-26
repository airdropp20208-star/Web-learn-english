// Translation route — uses Google Translate free endpoint (no API key required)
// Falls back to MyMemory API if Google fails
// Returns Vietnamese translation for an English word or short text

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { guardRequest, languageCodeSchema, readJson } from "@/lib/api-guard";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

// In-memory cache (per server instance) — translations are stable
const cache = new Map<string, string>();

/**
 * Đầu vào của route dịch.
 *
 * Trần 1.000 ký tự giữ nguyên như code cũ: chỗ gọi thật chỉ dịch một từ hoặc
 * một câu ví dụ, còn endpoint Google không chính thức vốn dành cho đoạn ngắn.
 *
 * `source`/`target` bắt buộc phải là mã ngôn ngữ. Trước đây chúng được nối
 * thẳng vào query string gửi sang Google mà không mã hoá — client nhét được
 * `&` cùng tham số lạ vào request mà máy chủ ta đứng tên gửi đi.
 */
const translateSchema = z.object({
  text: z
    .string()
    .max(1000, "Văn bản quá dài, tối đa 1000 ký tự.")
    .refine((value) => value.trim().length > 0, "Thiếu văn bản cần dịch."),
  source: languageCodeSchema.default("en"),
  target: languageCodeSchema.default("vi"),
});

export async function POST(req: NextRequest) {
  // Không bắt đăng nhập: tra nghĩa là thao tác cơ bản nhất của app, khách phải
  // dùng được. Đổi lại thì siết tần suất, vì mỗi lượt là một request gửi tới
  // endpoint Google không chính thức — lạm dụng là chặn IP.
  const gate = await guardRequest(req, RATE_LIMITS.translate);
  if (!gate.ok) return gate.response;

  const parsed = await readJson(req, translateSchema);
  if (!parsed.ok) return parsed.response;
  const { text, source, target } = parsed.data;

  try {
    const cacheKey = `${source}:${target}:${text.toLowerCase().trim()}`;
    if (cache.has(cacheKey)) {
      return NextResponse.json(
        {
          translation: cache.get(cacheKey),
          source: "cache",
        },
        { headers: gate.headers }
      );
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
            return NextResponse.json(
              {
                translation,
                source: "google",
              },
              { headers: gate.headers }
            );
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
          return NextResponse.json(
            {
              translation,
              source: "mymemory",
            },
            { headers: gate.headers }
          );
        }
      }
    } catch (err) {
      console.log("[translate] MyMemory failed:", err instanceof Error ? err.message : "unknown");
    }

    return NextResponse.json(
      { error: "Translation service unavailable", translation: null },
      { status: 503, headers: gate.headers }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
