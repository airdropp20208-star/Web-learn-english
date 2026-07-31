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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ListChecks, CheckCircle2, XCircle, RotateCcw, AlertCircle } from "lucide-react";
import type { QuizResponse, TextDTO, VocabItemDTO, QuizType } from "@/lib/types";
import { getTexts, getVocabItems, saveQuizQuestions, getMemoryItems, reviewMemoryItem } from "@/lib/storage";
import type { ReviewRating } from "@/lib/fsrs";

interface QuizTabProps {
  userId: string;
}

interface QuizQuestion {
  type: QuizType;
  question: string;
  options?: string[];
  correctAnswer: string;
  relatedWord?: string;
}

export function QuizTab({ userId }: QuizTabProps) {
  const [texts, setTexts] = useState<TextDTO[]>([]);
  const [vocabs, setVocabs] = useState<VocabItemDTO[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [timings, setTimings] = useState<Record<number, number>>({});
  const [questionStart, setQuestionStart] = useState<number>(Date.now());
  const [featureError, setFeatureError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [t, v] = await Promise.all([
        getTexts(userId),
        getVocabItems(userId),
      ]);
      if (!cancelled) {
        setTexts(t);
        setVocabs(v);
        if (t.length > 0) setSelectedTextId(t[0].id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const selectedText = useMemo(
    () => texts.find((t) => t.id === selectedTextId) ?? null,
    [texts, selectedTextId]
  );

  async function handleGenerate() {
    if (!selectedText) {
      toast.error("Pick a text first");
      return;
    }
    setGenerating(true);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setFeatureError(null);
    try {
      const vocabForQuiz = vocabs
        .filter((v) => v.sourceTextId === selectedText.id)
        .map((v) => ({
          word: v.word,
          definition: v.definition,
          contextSentence: v.contextSentence,
        }));
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textId: selectedText.id,
          text: selectedText.content,
          vocabList: vocabForQuiz,
        }),
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
        throw new Error(err.error ?? "Quiz generation failed");
      }
      const data: QuizResponse = await res.json();
      setQuestions(data.questions);
      setQuestionStart(Date.now());
      // Persist questions to DB
      await saveQuizQuestions(userId, selectedText.id, data.questions);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to generate quiz";
      if (!featureError) toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  function handleAnswer(idx: number, value: string) {
    if (submitted) return;
    if (!answers[idx]) {
      // First time answering this question → record timing
      setTimings((prev) => ({ ...prev, [idx]: Date.now() - questionStart }));
    }
    setAnswers((prev) => ({ ...prev, [idx]: value }));
  }

  async function handleSubmit() {
    if (!selectedText) return;
    setSubmitted(true);

    // Update memory items based on answers
    const memoryItems = await getMemoryItems(userId);
    const textVocabs = vocabs.filter((v) => v.sourceTextId === selectedText.id);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const userAnswer = (answers[i] ?? "").trim().toLowerCase();
      const correct = userAnswer === q.correctAnswer.trim().toLowerCase();
      const latency = timings[i] ?? 5000;

      // Find related memory item (match by word if relatedWord present)
      let relatedMemoryId: string | null = null;
      if (q.relatedWord) {
        const v = textVocabs.find(
          (x) => x.word.toLowerCase() === q.relatedWord!.toLowerCase()
        );
        if (v) relatedMemoryId = v.memoryItemId;
      }

      if (relatedMemoryId) {
        const memItem = memoryItems.find((m) => m.id === relatedMemoryId);
        if (memItem) {
          // FSRS: Again (2) if wrong, Good (4) if correct
          const rating: ReviewRating = correct ? 4 : 2;
          await reviewMemoryItem(relatedMemoryId, rating);
        }
      }
    }

    const correctCount = questions.filter(
      (q, i) =>
        (answers[i] ?? "").trim().toLowerCase() ===
        q.correctAnswer.trim().toLowerCase()
    ).length;
    toast.success(
      `Quiz submitted — ${correctCount}/${questions.length} correct. Memory updated.`
    );
  }

  function handleReset() {
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setTimings({});
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (texts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          You need to read and save a text first. Switch to the <strong>Read</strong> tab.
        </CardContent>
      </Card>
    );
  }

  const correctCount = submitted
    ? questions.filter(
        (q, i) =>
          (answers[i] ?? "").trim().toLowerCase() ===
          q.correctAnswer.trim().toLowerCase()
      ).length
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate quiz</CardTitle>
          <CardDescription>
            Pick a saved text. AI will create a mix of mcq, cloze, and recall questions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="text-select">Text</Label>
            <Select value={selectedTextId} onValueChange={setSelectedTextId}>
              <SelectTrigger id="text-select">
                <SelectValue placeholder="Pick a text" />
              </SelectTrigger>
              <SelectContent>
                {texts.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title} ({t.cefrLevel})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            <ListChecks className="w-4 h-4 mr-1.5" />
            {generating ? "Generating…" : "Generate quiz"}
          </Button>
        </CardContent>
      </Card>

      {featureError && (
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

      {questions.length > 0 && (
        <>
          {submitted && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    Score: {correctCount}/{questions.length}
                  </span>
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    New quiz
                  </Button>
                </div>
                <Progress
                  value={(correctCount / questions.length) * 100}
                  className="h-2"
                />
              </CardContent>
            </Card>
          )}

          {questions.map((q, idx) => {
            const userAns = answers[idx] ?? "";
            const isCorrect =
              submitted &&
              userAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
            return (
              <Card key={idx}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium">
                      Q{idx + 1}. {q.question}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{q.type}</Badge>
                      {submitted &&
                        (isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600" />
                        ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {q.type === "mcq" && q.options ? (
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const isSelected = userAns === opt;
                        const showCorrect =
                          submitted && opt === q.correctAnswer;
                        const showWrong = submitted && isSelected && !isCorrect;
                        return (
                          <button
                            key={oi}
                            disabled={submitted}
                            onClick={() => handleAnswer(idx, opt)}
                            className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                              showCorrect
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                                : showWrong
                                ? "border-rose-500 bg-rose-50 dark:bg-rose-950"
                                : isSelected
                                ? "border-primary bg-primary/5"
                                : "hover:bg-accent"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  ) : q.type === "cloze" ? (
                    <Input
                      value={userAns}
                      onChange={(e) => handleAnswer(idx, e.target.value)}
                      disabled={submitted}
                      placeholder="Type the missing word…"
                    />
                  ) : (
                    <Textarea
                      value={userAns}
                      onChange={(e) => handleAnswer(idx, e.target.value)}
                      disabled={submitted}
                      placeholder="Type your answer…"
                      className="min-h-[60px]"
                    />
                  )}
                  {submitted && !isCorrect && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2">
                      Correct answer: <strong>{q.correctAnswer}</strong>
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {!submitted && (
            <Button onClick={handleSubmit} className="w-full" size="lg">
              Submit answers
            </Button>
          )}
        </>
      )}
    </div>
  );
}
