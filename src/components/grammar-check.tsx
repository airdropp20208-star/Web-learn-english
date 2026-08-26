"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { SpellCheck2, CheckCircle2, RefreshCw } from "lucide-react";
import type { GrammarCheckResponse } from "@/lib/types";

type Match = GrammarCheckResponse["matches"][number];

interface GrammarCheckProps {
  /** Văn bản đang soạn. Đổi thì kết quả cũ thành lỗi thời. */
  text: string;
  /** Gọi khi người dùng nhận một gợi ý sửa. */
  onApplyFix: (nextText: string) => void;
}

/**
 * Tên nhóm lỗi của LanguageTool sang tiếng Việt.
 *
 * Chỉ dịch những nhóm hay gặp nhất; nhóm lạ thì để nguyên tên tiếng Anh họ
 * trả về, vì đoán bừa một bản dịch còn khó hiểu hơn.
 */
const TEN_NHOM: Record<string, string> = {
  TYPOS: "Sai chính tả",
  GRAMMAR: "Ngữ pháp",
  PUNCTUATION: "Dấu câu",
  TYPOGRAPHY: "Trình bày",
  CASING: "Viết hoa",
  COLLOCATIONS: "Kết hợp từ",
  CONFUSED_WORDS: "Từ dễ nhầm",
  REDUNDANCY: "Thừa từ",
  STYLE: "Văn phong",
  SEMANTICS: "Ngữ nghĩa",
  MISC: "Khác",
};

function tenNhom(m: Match): string {
  const id = m.rule.category.id;
  return TEN_NHOM[id] ?? m.rule.category.name ?? "Khác";
}

/**
 * Áp một gợi ý vào văn bản, rồi dời chỗ những lỗi còn lại cho khớp.
 *
 * Sửa một chỗ là mọi `offset` phía sau đều lệch đi đúng bằng chênh lệch độ
 * dài. Không dời thì lần sửa thứ hai sẽ cắt nhầm vị trí — và người dùng chỉ
 * thấy văn bản của mình bị băm ra, không hiểu vì sao.
 */
export function apDungGoiY(
  text: string,
  matches: Match[],
  target: Match,
  replacement: string
): { text: string; matches: Match[] } {
  const nextText =
    text.slice(0, target.offset) +
    replacement +
    text.slice(target.offset + target.length);
  const delta = replacement.length - target.length;

  const nextMatches = matches
    .filter((m) => m !== target)
    // Lỗi chồng lấn lên đoạn vừa sửa thì không còn nói về văn bản hiện tại
    // nữa, bỏ luôn thay vì để lại một gợi ý trỏ vào chỗ đã đổi.
    .filter(
      (m) =>
        m.offset + m.length <= target.offset ||
        m.offset >= target.offset + target.length
    )
    .map((m) => (m.offset > target.offset ? { ...m, offset: m.offset + delta } : m));

  return { text: nextText, matches: nextMatches };
}

export function GrammarCheck({ text, onApplyFix }: GrammarCheckProps) {
  const [checking, setChecking] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);
  /**
   * Bản văn tại thời điểm bấm kiểm tra.
   *
   * Mọi `offset` chỉ đúng với đúng chuỗi này. Người dùng gõ thêm một chữ là
   * cả danh sách lệch, nên phải so lại trước khi cho bấm gợi ý.
   */
  const [checkedText, setCheckedText] = useState<string | null>(null);

  const loiThoi = checkedText !== null && checkedText !== text;

  async function handleCheck() {
    if (!text.trim()) return;
    setChecking(true);
    try {
      const res = await fetch("/api/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: "en-US" }),
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Bạn kiểm tra hơi nhanh, chờ một chút rồi thử lại.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(
          body.error ??
            "Dịch vụ kiểm tra ngữ pháp đang không phản hồi. Thử lại sau ít phút."
        );
        return;
      }

      const data: GrammarCheckResponse = await res.json();
      setMatches(data.matches);
      setCheckedText(text);
      if (data.matches.length === 0) toast.success("Không tìm thấy lỗi nào.");
    } catch {
      toast.error("Không gọi được dịch vụ kiểm tra ngữ pháp.");
    } finally {
      setChecking(false);
    }
  }

  function handleApply(target: Match, replacement: string) {
    if (!matches || checkedText === null) return;
    // Chặn ở đây thay vì chỉ làm mờ nút: văn bản có thể đổi ngay giữa lúc
    // người dùng đang rê chuột tới.
    if (loiThoi) {
      toast.error("Văn bản đã thay đổi. Hãy kiểm tra lại trước khi sửa.");
      return;
    }
    const ketQua = apDungGoiY(text, matches, target, replacement);
    setMatches(ketQua.matches);
    setCheckedText(ketQua.text);
    onApplyFix(ketQua.text);
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        onClick={handleCheck}
        disabled={checking || !text.trim()}
        className="w-full sm:w-auto"
      >
        <SpellCheck2 className="w-4 h-4 mr-1.5" />
        {checking ? "Đang kiểm tra…" : "Kiểm tra ngữ pháp"}
      </Button>

      {matches !== null && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {matches.length === 0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Không còn lỗi nào
                </>
              ) : (
                <>
                  <SpellCheck2 className="w-4 h-4" />
                  {matches.length} chỗ nên xem lại
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loiThoi && (
              <p className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                <RefreshCw className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>
                  Văn bản đã đổi từ lần kiểm tra trước, các gợi ý dưới đây không
                  còn khớp vị trí. Bấm kiểm tra lại.
                </span>
              </p>
            )}

            {matches.length > 0 && (
              <ScrollArea className="max-h-72">
                <div className="space-y-2 pr-2">
                  {matches.map((m, i) => {
                    const doanSai = checkedText?.slice(m.offset, m.offset + m.length) ?? "";
                    return (
                      <div
                        key={`${m.rule.id}-${m.offset}-${i}`}
                        className="rounded-md border p-2.5 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <code className="rounded bg-rose-100 px-1.5 py-0.5 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 break-all">
                            {doanSai || "(khoảng trắng)"}
                          </code>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {tenNhom(m)}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {m.shortMessage || m.message}
                        </p>

                        {m.replacements.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {/* Cắt ở 5: có lỗi chính tả LanguageTool trả về ba
                                chục phương án, đổ hết ra thì không ai đọc. */}
                            {m.replacements.slice(0, 5).map((r, ri) => (
                              <Button
                                key={ri}
                                size="sm"
                                variant="secondary"
                                disabled={loiThoi}
                                className="h-7 px-2 text-xs"
                                onClick={() => handleApply(m, r.value)}
                              >
                                {r.value || "(xoá)"}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            <p className="mt-3 text-[11px] text-muted-foreground">
              Máy kiểm tra bằng LanguageTool nên chỉ bắt được lỗi hình thức, và
              đôi khi báo nhầm. Câu nào bạn thấy vẫn đúng thì cứ giữ nguyên.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
