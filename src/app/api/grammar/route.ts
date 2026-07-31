// Grammar check route — proxies LanguageTool public API (free, no key)
// Returns categorized grammar/style/typography errors

import { NextRequest, NextResponse } from "next/server";
import type { GrammarCheckResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, language = "en-US" } = body as { text?: string; language?: string };

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing 'text' field" },
        { status: 400 }
      );
    }

    if (text.length > 20000) {
      return NextResponse.json(
        { error: "Text too long (max 20000 characters)" },
        { status: 400 }
      );
    }

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

    return NextResponse.json(response);
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
