import { NextRequest, NextResponse } from "next/server";
import { generateQuiz, GeminiError } from "@/lib/ai-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { textId, text, vocabList } = body as {
      textId?: string;
      text?: string;
      vocabList?: Array<{ word: string; definition: string; contextSentence: string }>;
    };

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing 'text'" }, { status: 400 });
    }

    const vocab = Array.isArray(vocabList) ? vocabList : [];
    const result = await generateQuiz(textId ?? "unknown", text, vocab);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof GeminiError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
        },
        { status: err.statusCode }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
