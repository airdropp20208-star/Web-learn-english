"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Sparkles, Save, FileText, AlertCircle } from "lucide-react";
import { PronounceButton } from "@/components/pronounce-button";
import { GrammarCheck } from "@/components/grammar-check";
import type { AnalyzeResponse, CEFRLevel, TextDTO } from "@/lib/types";
import { createText, saveVocabItem, getTexts } from "@/lib/storage";
import { CEFR_COLOR } from "@/lib/level-colors";

interface ReadTabProps {
  userId: string;
}

export function ReadTab({ userId }: ReadTabProps) {
  const [rawText, setRawText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [savedText, setSavedText] = useState<TextDTO | null>(null);
  const [savedVocabIds, setSavedVocabIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<TextDTO[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [featureError, setFeatureError] = useState<string | null>(null);
  const [viCache, setViCache] = useState<Record<string, string>>({});

  // Không bật lại spinner ở đây: hàm này còn được gọi để làm mới danh sách
  // sau khi lưu một bài đọc, và cho danh sách biến mất một nhịp chỉ để hiện
  // ô xám thì tệ hơn là để nó tự cập nhật. Lần nạp đầu đã có `loadingHistory`
  // khởi tạo `true` lo liệu.
  const loadHistory = useCallback(async () => {
    try {
      const texts = await getTexts(userId);
      setHistory(texts);
    } finally {
      setLoadingHistory(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHistory().catch(() => toast.error("Không tải được lịch sử bài đọc."));
  }, [loadHistory]);

  async function handleAnalyze() {
    if (!rawText.trim()) {
      toast.error("Hãy dán một đoạn văn trước đã.");
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    setSavedText(null);
    setSavedVocabIds(new Set());
    setFeatureError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 503) {
          setFeatureError(
            err.message ??
              "Máy chủ chưa được cấu hình khoá AI nên chưa phân tích được."
          );
          throw new Error(err.message ?? "Chưa cấu hình AI");
        }
        throw new Error(err.error ?? "Phân tích thất bại.");
      }
      const data: AnalyzeResponse = await res.json();
      setAnalysis(data);

      // Lưu bài đọc lại để lần sau mở ra học tiếp
      const text = await createText(userId, {
        title: data.title,
        content: rawText,
        cefrLevel: data.cefrLevel,
        summary: data.summary,
      });
      setSavedText(text);
      await loadHistory();
      toast.success(`Đã lưu với tên "${data.title}"`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Có lỗi không rõ.";
      if (!featureError) toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveVocab(word: AnalyzeResponse["highlightedWords"][number]) {
    if (!savedText) {
      toast.error("Bài đọc chưa được lưu.");
      return;
    }
    if (savedVocabIds.has(word.word)) return;

    // Lấy nghĩa tiếng Việt nếu chưa có trong cache
    let vietnamese: string | null = viCache[word.word] ?? null;
    if (!vietnamese) {
      try {
        const transRes = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: word.word, target: "vi" }),
        });
        if (transRes.ok) {
          const transData = await transRes.json();
          if (transData.translation) {
            vietnamese = transData.translation;
            setViCache((prev) => ({ ...prev, [word.word]: transData.translation }));
          }
        }
      } catch {
        // Không có nghĩa tiếng Việt vẫn lưu được, đừng chặn người dùng vì nó
      }
    }

    try {
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
      setSavedVocabIds((prev) => new Set(prev).add(word.word));
      toast.success(
        `Đã lưu "${word.word}"${vietnamese ? ` (${vietnamese})` : ""} vào sổ từ.`
      );
    } catch {
      toast.error("Không lưu được từ này.");
    }
  }

  // Dựng đoạn văn có tô sáng từ vựng
  const renderedContent = useMemo(() => {
    if (!analysis || !savedText) return null;
    const { highlightedWords } = analysis;
    const text = savedText.content;
    if (highlightedWords.length === 0) {
      return <p className="leading-relaxed">{text}</p>;
    }

    // Dịch sẵn các từ được tô sáng ở nền, không chờ — nghĩa tiếng Việt sẽ hiện
    // trong popover khi nào về tới.
    for (const w of highlightedWords) {
      if (!viCache[w.word]) {
        fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: w.word, target: "vi" }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.translation) {
              setViCache((prev) =>
                prev[w.word] ? prev : { ...prev, [w.word]: data.translation }
              );
            }
          })
          .catch(() => {});
      }
    }

    const sorted = [...highlightedWords].sort((a, b) => a.position - b.position);
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    sorted.forEach((w, idx) => {
      if (w.position > cursor) {
        parts.push(<span key={`t-${idx}`}>{text.slice(cursor, w.position)}</span>);
      }
      parts.push(
        <Popover key={`w-${idx}`}>
          <PopoverTrigger asChild>
            <button
              aria-label={`Xem nghĩa của từ ${w.word}`}
              className={`px-1 rounded-sm border-b-2 font-medium cursor-pointer hover:bg-accent ${CEFR_COLOR[w.cefrLevel]}`}
            >
              {text.slice(w.position, w.position + w.word.length)}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{w.word}</div>
                  {w.ipa && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">
                        {w.ipa}
                      </span>
                      <PronounceButton word={w.word} audioUrl={w.audioUrl} />
                    </div>
                  )}
                  <Badge variant="outline" className={`mt-1 ${CEFR_COLOR[w.cefrLevel]}`}>
                    {w.cefrLevel}
                  </Badge>
                </div>
                {savedVocabIds.has(w.word) && <Badge variant="secondary">Đã lưu</Badge>}
              </div>
              {w.definition && <p className="text-sm">{w.definition}</p>}
              {viCache[w.word] && (
                <p className="text-sm font-medium text-primary">{viCache[w.word]}</p>
              )}
              {w.example && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Ví dụ:</span> {w.example}
                </div>
              )}
              <div className="text-xs text-muted-foreground border-l-2 pl-2 italic">
                &ldquo;{w.contextSentence}&rdquo;
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => handleSaveVocab(w)}
                disabled={savedVocabIds.has(w.word)}
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                {savedVocabIds.has(w.word) ? "Đã có trong sổ từ" : "Lưu vào sổ từ"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      );
      cursor = w.position + w.word.length;
    });
    if (cursor < text.length) {
      parts.push(<span key="t-end">{text.slice(cursor)}</span>);
    }
    return <p className="leading-relaxed">{parts}</p>;
  }, [analysis, savedText, savedVocabIds]);

  const doDoc = analysis?.readability ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Trái: ô nhập + kết quả phân tích */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dán một đoạn văn để phân tích</CardTitle>
            <CardDescription>
              Bài báo, truyện, đoạn văn tiếng Anh bất kỳ. AI sẽ rút từ vựng đáng học
              và ước lượng trình độ CEFR.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Dán đoạn tiếng Anh vào đây…"
              className="min-h-[180px] resize-y"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {rawText.length} ký tự
              </span>
              <Button onClick={handleAnalyze} disabled={analyzing || !rawText.trim()}>
                <Sparkles className="w-4 h-4 mr-1.5" />
                {analyzing ? "Đang phân tích…" : "Phân tích"}
              </Button>
            </div>

            {/* Kiểm tra ngữ pháp chạy qua LanguageTool, không cần khoá AI — nên
                vẫn dùng được cả khi nút Phân tích ở trên báo chưa cấu hình. */}
            <GrammarCheck text={rawText} onApplyFix={setRawText} />
          </CardContent>
        </Card>

        {analyzing && (
          <Card>
            <CardContent className="p-6 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        )}

        {featureError && !analyzing && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-medium text-amber-900 dark:text-amber-200">
                  Chưa dùng được tính năng AI
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {featureError}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                  Người quản trị cần đặt biến môi trường{" "}
                  <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900">
                    GEMINI_API_KEYS
                  </code>{" "}
                  trên Vercel (Project → Settings → Environment Variables). Nhiều khoá
                  thì ngăn cách bằng dấu phẩy để luân phiên.
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Trong lúc chờ, nút <strong>Kiểm tra ngữ pháp</strong> ở trên vẫn hoạt
                  động bình thường.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {analysis && savedText && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{analysis.title}</CardTitle>
                  <CardDescription>{analysis.summary}</CardDescription>
                </div>
                <Badge className={CEFR_COLOR[analysis.cefrLevel]}>
                  {analysis.cefrLevel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {doDoc && (
                <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{doDoc.wordCount}</strong> từ
                  </span>
                  <span>
                    Độ dễ đọc{" "}
                    <strong className="text-foreground">
                      {Math.round(doDoc.fleschReading)}
                    </strong>
                    /100
                  </span>
                  <span>
                    Trình độ đọc lớp{" "}
                    <strong className="text-foreground">
                      {Math.round(doDoc.fleschKincaid)}
                    </strong>
                  </span>
                  <span>
                    Ước lượng{" "}
                    <strong className="text-foreground">{doDoc.cefrEstimate}</strong>
                  </span>
                </div>
              )}
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {renderedContent}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Bấm vào từ được tô sáng để xem nghĩa và lưu vào sổ từ.</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Phải: lịch sử */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Bài đọc gần đây
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có bài đọc nào. Phân tích một đoạn văn ở bên trái, nó sẽ được lưu
                lại đây.
              </p>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-2 pr-2">
                  {history.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="w-full border rounded-md p-2 text-left hover:bg-accent"
                      onClick={() => {
                        setRawText(t.content);
                        setSavedText(t);
                        setAnalysis({
                          title: t.title,
                          cefrLevel: t.cefrLevel,
                          summary: t.summary ?? "",
                          highlightedWords: [],
                          // Bài đọc lưu từ trước có thể chưa có điểm dễ đọc;
                          // `null` là "chưa tính", khác với "đã tính ra 0".
                          readability: t.readability ?? null,
                        });
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{t.title}</span>
                        <Badge variant="outline" className={CEFR_COLOR[t.cefrLevel]}>
                          {t.cefrLevel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {t.content.slice(0, 80)}…
                      </p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
