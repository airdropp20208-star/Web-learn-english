import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateQuiz, GeminiError } from "@/lib/ai-client";
import { guardRequest, readJson } from "@/lib/api-guard";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Trần độ dài bài đọc gửi lên sinh quiz.
 *
 * Trước đây không có trần nào cả: `text` đi thẳng từ body vào prompt Gemini.
 * Một request 5 MB là một prompt hơn một triệu token, tức vài đô cho **một**
 * lượt gọi, và kẻ gửi không cần tài khoản.
 *
 * Chọn 20.000 vì đó đúng bằng trần của `/api/analyze` — mọi bài đọc trong app
 * đều đi qua đó trước khi được lưu, nên không bài hợp lệ nào vượt được con số
 * này. 20.000 ký tự cỡ 5.000 token, chi phí một lượt vẫn ở mức phần trăm xu.
 */
const MAX_TEXT_LENGTH = 20_000;

/**
 * Số mục từ vựng thật sự nhét vào prompt.
 *
 * Từng mục được trải thành một dòng "từ: định nghĩa (ngữ cảnh)". Một bài đọc
 * hay có 5–10 từ được lưu; quiz chỉ sinh 4–5 câu nên nhiều hơn 30 mục cũng
 * không cải thiện gì, chỉ làm prompt phình. Cắt bớt thay vì trả lỗi 400, vì
 * người dùng lưu nhiều từ là chuyện hợp lệ chứ không phải sai đầu vào.
 */
const MAX_VOCAB_IN_PROMPT = 30;

const vocabEntrySchema = z.object({
  word: z.string().max(200),
  definition: z.string().max(2000),
  contextSentence: z.string().max(2000),
});

const quizSchema = z.object({
  textId: z.string().max(64).optional(),
  text: z
    .string()
    .max(MAX_TEXT_LENGTH, `Bài đọc quá dài, tối đa ${MAX_TEXT_LENGTH} ký tự.`)
    .refine((value) => value.trim().length > 0, "Thiếu nội dung bài đọc."),
  // Trần 200 chỉ để chặn payload phi lý; con số có ý nghĩa là
  // MAX_VOCAB_IN_PROMPT ở dưới.
  vocabList: z.array(vocabEntrySchema).max(200).optional(),
});

export async function POST(req: NextRequest) {
  // Cho khách dùng — app cố ý chạy được khi chưa đăng nhập, và quiz là một
  // trong những tính năng chính. Bù lại đây là route tốn tiền nhất nên hạn mức
  // chặt nhất, và khoá theo tài khoản khi có phiên đăng nhập.
  const gate = await guardRequest(req, RATE_LIMITS.quiz);
  if (!gate.ok) return gate.response;

  const parsed = await readJson(req, quizSchema);
  if (!parsed.ok) return parsed.response;
  const { textId, text, vocabList } = parsed.data;

  try {
    const vocab = (vocabList ?? []).slice(0, MAX_VOCAB_IN_PROMPT);
    const result = await generateQuiz(textId ?? "unknown", text, vocab);
    return NextResponse.json(result, { headers: gate.headers });
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
