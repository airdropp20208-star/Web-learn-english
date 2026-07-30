"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import type { AnalyzeResponse, CEFRLevel, TextDTO, VocabItemDTO } from "@/lib/types";
import { createText, saveVocabItem, getTexts } from "@/lib/storage";

interface ReadTabProps {
  userId: string;
}

const CEFR_COLOR: Record<CEFRLevel, string> = {
  A1: "bg-emerald-100 text-emerald-700 border-emerald-200",
  A2: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B1: "bg-amber-100 text-amber-700 border-amber-200",
  B2: "bg-orange-100 text-orange-700 border-orange-200",
  C1: "bg-rose-100 text-rose-700 border-rose-200",
  C2: "bg-red-100 text-red-700 border-red-200",
};

export function ReadTab({ userId }: ReadTabProps) {
  const [rawText, setRawText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [savedText, setSavedText] = useState<TextDTO | null>(null);
  const [savedVocabIds, setSavedVocabIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<TextDTO[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [featureError, setFeatureError] = useState<string | null>(null);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const texts = await getTexts(userId);
      setHistory(texts);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [userId]);

  async function handleAnalyze() {
    if (!rawText.trim()) {
      toast.error("Please paste some text first");
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
              "AI feature unavailable. Set GEMINI_API_KEYS environment variable on Vercel to enable."
          );
          throw new Error(err.message ?? "AI not configured");
        }
        throw new Error(err.error ?? "Analyze failed");
      }
      const data: AnalyzeResponse = await res.json();
      setAnalysis(data);

      // Save text to DB
      const text = await createText(userId, {
        title: data.title,
        content: rawText,
        cefrLevel: data.cefrLevel,
        summary: data.summary,
      });
      setSavedText(text);
      await loadHistory();
      toast.success(`Saved as "${data.title}"`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (!featureError) toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveVocab(word: AnalyzeResponse["highlightedWords"][number]) {
    if (!savedText) {
      toast.error("Text not saved yet");
      return;
    }
    if (savedVocabIds.has(word.word)) return;
    try {
      await saveVocabItem(userId, {
        word: word.word,
        definition: word.definition,
        exampleSentence: word.example,
        contextSentence: word.contextSentence,
        cefrLevel: word.cefrLevel,
        sourceTextId: savedText.id,
      });
      setSavedVocabIds((prev) => new Set(prev).add(word.word));
      toast.success(`"${word.word}" saved to vocab`);
    } catch (e: unknown) {
      toast.error("Failed to save vocab");
    }
  }

  // Build highlighted content
  const renderedContent = useMemo(() => {
    if (!analysis || !savedText) return null;
    const { highlightedWords } = analysis;
    const text = savedText.content;
    if (highlightedWords.length === 0) {
      return <p className="leading-relaxed">{text}</p>;
    }
    // Sort by position
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
              className={`px-1 rounded-sm border-b-2 font-medium cursor-pointer hover:bg-accent ${CEFR_COLOR[w.cefrLevel]}`}
            >
              {text.slice(w.position, w.position + w.word.length)}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{w.word}</div>
                  <Badge variant="outline" className={CEFR_COLOR[w.cefrLevel]}>
                    {w.cefrLevel}
                  </Badge>
                </div>
                {savedVocabIds.has(w.word) && (
                  <Badge variant="secondary">Saved</Badge>
                )}
              </div>
              <p className="text-sm">{w.definition}</p>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Example:</span> {w.example}
              </div>
              <div className="text-xs text-muted-foreground border-l-2 pl-2 italic">
                "{w.contextSentence}"
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => handleSaveVocab(w)}
                disabled={savedVocabIds.has(w.word)}
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                {savedVocabIds.has(w.word) ? "Already saved" : "Save to vocab"}
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: input + analysis */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paste a text to analyze</CardTitle>
            <CardDescription>
              Any English text — article, story, paragraph. AI will extract vocabulary and estimate CEFR level.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste any English text here…"
              className="min-h-[180px] resize-y"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {rawText.length} chars
              </span>
              <Button onClick={handleAnalyze} disabled={analyzing || !rawText.trim()}>
                <Sparkles className="w-4 h-4 mr-1.5" />
                {analyzing ? "Analyzing…" : "Analyze"}
              </Button>
            </div>
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
                  AI feature unavailable
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {featureError}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                  Set <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900">GEMINI_API_KEYS</code> environment variable on Vercel
                  (Project → Settings → Environment Variables). Use comma-separated values for multi-key rotation.
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
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {renderedContent}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Click any highlighted word to see its meaning and save it.</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: history */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Recent texts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No texts yet.</p>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-2 pr-2">
                  {history.map((t) => (
                    <div
                      key={t.id}
                      className="border rounded-md p-2 hover:bg-accent cursor-pointer"
                      onClick={() => {
                        setRawText(t.content);
                        setSavedText(t);
                        setAnalysis({
                          title: t.title,
                          cefrLevel: t.cefrLevel,
                          summary: t.summary ?? "",
                          highlightedWords: [],
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
                    </div>
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
