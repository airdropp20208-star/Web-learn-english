// Grammar check route — proxies LanguageTool public API (free, no key)
// Returns categorized grammar/style/typography errors

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { guardRequest, languageCodeSchema, readJson } from "@/lib/api-guard";
import { RATE_LIMITS } from "@/lib/rate-limit";
import type { GrammarCheckResponse } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Trần 20.000 ký tự giữ nguyên như code cũ — cũng xấp xỉ trần mỗi request của
 * LanguageTool miễn phí. `language` phải là mã ngôn ngữ hợp lệ: giá trị này
 * được ghép vào form body gửi sang họ, thả tự do là để client tự đặt tham số
 * cho request mà máy chủ ta gửi đi.
 */
const grammarSchema = z.object({
  text: z
    .string()
    .max(20_000, "Văn bản quá dài, tối đa 20000 ký tự.")
    .refine((value) => value.trim().length > 0, "Thiếu văn bản cần kiểm tra."),
  language: languageCodeSchema.default("en-US"),
});

export async function POST(req: NextRequest) {
  // Cho khách dùng: kiểm tra ngữ pháp không đụng tới dữ liệu của ai. Nhưng đây
  // là proxy tới hạn mức miễn phí của LanguageTool, mà hạn mức đó tính theo IP
  // của *máy chủ ta* — một người gọi loạn là cả app bị họ khoá.
  const gate = await guardRequest(req, RATE_LIMITS.grammar);
  if (!gate.ok) return gate.response;

  const parsed = await readJson(req, grammarSchema);
  if (!parsed.ok) return parsed.response;
  const { text, language } = parsed.data;

  try {
    // Call LanguageTool public API
    const params = new URLSearchParams();
    params.append("text", text);
    params.append("language", language);
    params.append("enabledOnly", "false");

    const ltRes = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!ltRes.ok) {
      return NextResponse.json(
        { error: `LanguageTool API error: ${ltRes.status}` },
        { status: 502 }
      );
    }

    const data = await ltRes.json();

    const response: GrammarCheckResponse = {
      matches: (data.matches || []).map((m: any) => ({
        message: m.message || "",
        shortMessage: m.shortMessage,
        offset: m.offset || 0,
        length: m.length || 0,
        rule: {
          id: m.rule?.id || "",
          description: m.rule?.description || "",
          category: {
            id: m.rule?.category?.id || "",
            name: m.rule?.category?.name || "",
          },
        },
        replacements: (m.replacements || []).map((r: any) => ({
          value: r.value || "",
        })),
      })),
    };

    return NextResponse.json(response, { headers: gate.headers });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Grammar check timed out. Try again." },
        { status: 504 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
