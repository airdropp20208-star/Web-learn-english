"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { BookOpen, ArrowLeft, Sparkles } from "lucide-react";
import type { CEFRLevel, AnalyzeResponse, TextDTO } from "@/lib/types";
import { createText, saveVocabItem, getTexts, getVocabItems } from "@/lib/storage";
import { CEFR_COLOR } from "@/lib/level-colors";
import {
  estimateUserLevel,
  loadCefrSpine,
  pickTopWords,
  suggestTexts,
  type CefrSpine,
} from "@/lib/content-curation";

interface LibraryTabProps {
  userId: string;
}

interface ReadingText {
  id: string;
  level: CEFRLevel;
  title: string;
  category: string;
  content: string;
  wordCount: number;
}

export function LibraryTab({ userId }: LibraryTabProps) {
  const [texts, setTexts] = useState<ReadingText[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<CEFRLevel | "all">("all");
  const [selectedText, setSelectedText] = useState<ReadingText | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Dữ liệu để gợi ý: lịch sử đọc, sổ từ đã lưu, và trục CEFR.
  const [history, setHistory] = useState<TextDTO[]>([]);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [spine, setSpine] = useState<CefrSpine | null>(null);

  /**
   * Tăng lên một để nạp lại lịch sử và sổ từ.
   *
   * Đi vòng qua một biến đếm thay vì gọi thẳng hàm nạp, vì mọi setState phải
   * nằm trong effect thì `react-hooks/set-state-in-effect` mới cho qua — và
   * cái giá phải trả cũng chính là cái được: effect có chỗ để huỷ khi người
   * dùng rời tab giữa chừng.
   */
  const [napLai, setNapLai] = useState(0);

  useEffect(() => {
    async function loadTexts() {
      try {
        const res = await fetch("/data/reading.json");
        if (!res.ok) throw new Error(`Thư viện trả về ${res.status}`);
        setTexts(await res.json());
      } catch {
        toast.error("Không tải được thư viện bài đọc.");
      } finally {
        setLoading(false);
      }
    }
    loadTexts();
  }, []);

  useEffect(() => {
    let daHuy = false;
    async function napDuLieuNguoiDung() {
      const [daDoc, vocab] = await Promise.all([
        getTexts(userId),
        getVocabItems(userId),
      ]);
      if (daHuy) return;
      setHistory(daDoc);
      setKnown(new Set(vocab.map((v) => v.word.toLowerCase())));
    }
    // Hỏng thì chỉ mất phần gợi ý, thư viện vẫn dùng bình thường — không đáng
    // để bắn toast làm phiền.
    napDuLieuNguoiDung().catch(() => {});
    return () => {
      daHuy = true;
    };
  }, [userId, napLai]);

  useEffect(() => {
    // Trục CEFR nặng ~210 KB nên chỉ tải khi người dùng thật sự mở tab này.
    // Hỏng thì im lặng: phần gợi ý biến mất, danh sách bài đọc không đổi.
    loadCefrSpine()
      .then(setSpine)
      .catch(() => {});
  }, []);

  const userLevel = useMemo(() => estimateUserLevel(history), [history]);

  const suggestions = useMemo(() => {
    if (!spine || texts.length === 0) return [];
    return suggestTexts({
      candidates: texts,
      history,
      known,
      spine,
      userLevel,
      limit: 3,
    });
  }, [spine, texts, history, known, userLevel]);

  const wordsToLearn = useMemo(() => {
    if (!spine || !selectedText) return [];
    return pickTopWords(selectedText.content, history, known, spine, userLevel, 10);
  }, [spine, selectedText, history, known, userLevel]);

  const filteredTexts = useMemo(() => {
    if (filterLevel === "all") return texts;
    return texts.filter((t) => t.level === filterLevel);
  }, [texts, filterLevel]);

  async function handleAnalyzeAndImport(text: ReadingText) {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.content }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 503) {
          throw new Error(
            errData.message ?? "Máy chủ chưa cấu hình khoá AI nên chưa phân tích được."
          );
        }
        throw new Error(errData.error || `Phân tích thất bại (${res.status})`);
      }
      const data: AnalyzeResponse = await res.json();

      const savedText = await createText(userId, {
        title: text.title,
        content: text.content,
        cefrLevel: data.cefrLevel,
        summary: data.summary,
        readability: data.readability,
      });

      // Lưu luôn toàn bộ từ được tô sáng vào sổ từ
      let savedCount = 0;
      let failedCount = 0;
      for (const word of data.highlightedWords) {
        try {
          let vietnamese: string | null = null;
          try {
            const transRes = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: word.word, target: "vi" }),
            });
            if (transRes.ok) {
              const transData = await transRes.json();
              if (transData.translation) vietnamese = transData.translation;
            }
          } catch {
            // Thiếu nghĩa tiếng Việt vẫn lưu được từ, đừng bỏ cả từ vì nó
          }

          await saveVocabItem(userId, {
            word: word.word,
            definition: word.definition,
            vietnamese,
            exampleSentence: word.example,
            contextSentence: word.contextSentence,
            cefrLevel: word.cefrLevel,
            ipa: word.ipa,
            audioUrl: word.audioUrl,
            sourceTextId: savedText.id,
          });
          savedCount++;
        } catch {
          failedCount++;
        }
      }

      // Nói thật số từ hỏng thay vì báo thành công tròn trịa rồi để người dùng
      // tự phát hiện sổ từ thiếu.
      toast.success(
        `Đã nhập "${text.title}" với ${savedCount} từ vựng` +
          (failedCount > 0 ? ` (${failedCount} từ không lưu được)` : "")
      );
      setSelectedText(null);
      setNapLai((k) => k + 1);
    } catch (err) {
      toast.error(
        `Không nhập được bài: ${err instanceof Error ? err.message : "lỗi không rõ"}`
      );
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (selectedText) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedText(null)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Về thư viện
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">{selectedText.title}</CardTitle>
                <CardDescription>
                  {selectedText.category} · {selectedText.wordCount} từ
                </CardDescription>
              </div>
              <Badge className={CEFR_COLOR[selectedText.level]}>
                {selectedText.level}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {wordsToLearn.length > 0 && (
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="mb-2 text-xs font-medium">
                  Từ đáng học trong bài này ({wordsToLearn.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {wordsToLearn.map((w) => (
                    <Badge
                      key={w.word}
                      variant="outline"
                      className={`text-[11px] ${CEFR_COLOR[w.cefr]}`}
                    >
                      {w.word}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Đây là những từ chưa có trong sổ từ của bạn và không thấp hơn trình
                  độ hiện tại.
                </p>
              </div>
            )}

            <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed">
              {selectedText.content}
            </div>
            <Button
              onClick={() => handleAnalyzeAndImport(selectedText)}
              disabled={analyzing}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {analyzing ? "Đang phân tích và nhập…" : "Phân tích và nhập vào sổ của tôi"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Bài sẽ được rút từ vựng kèm định nghĩa, phiên âm IPA và phát âm, rồi thêm
              vào sổ từ của bạn.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {suggestions.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Gợi ý cho bạn
            </CardTitle>
            <CardDescription>
              Dựa trên {history.length > 0 ? `${history.length} bài bạn đã đọc` : "trình độ khởi điểm"}
              , trình độ ước lượng{" "}
              <Badge variant="outline" className={`${CEFR_COLOR[userLevel]} align-middle`}>
                {userLevel}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {suggestions.map((s) => (
                <button
                  key={s.text.id}
                  type="button"
                  onClick={() => setSelectedText(s.text)}
                  className="rounded-md border p-3 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium leading-tight">
                      {s.text.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`${CEFR_COLOR[s.text.level]} shrink-0`}
                    >
                      {s.text.level}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium mr-2">Trình độ:</span>
            <button
              onClick={() => setFilterLevel("all")}
              aria-pressed={filterLevel === "all"}
              className={`px-3 py-1 rounded-md text-sm ${
                filterLevel === "all"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              Tất cả ({texts.length})
            </button>
            {(["A1", "A2", "B1", "B2", "C1", "C2"] as CEFRLevel[]).map((level) => {
              const count = texts.filter((t) => t.level === level).length;
              if (count === 0) return null;
              return (
                <button
                  key={level}
                  onClick={() => setFilterLevel(level)}
                  aria-pressed={filterLevel === level}
                  className={`px-3 py-1 rounded-md text-sm border ${
                    filterLevel === level
                      ? "bg-primary text-primary-foreground border-primary"
                      : CEFR_COLOR[level] + " hover:opacity-80"
                  }`}
                >
                  {level} ({count})
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {filteredTexts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Chưa có bài đọc nào ở trình độ này.
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-2">
            {filteredTexts.map((text) => (
              <Card
                key={text.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedText(text)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-sm leading-tight">{text.title}</h3>
                    <Badge
                      variant="outline"
                      className={CEFR_COLOR[text.level] + " shrink-0"}
                    >
                      {text.level}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {text.category} · {text.wordCount} từ
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {text.content.substring(0, 120)}…
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
