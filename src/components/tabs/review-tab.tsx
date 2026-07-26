"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Brain, CheckCircle2, XCircle, Play, RotateCcw } from "lucide-react";
import type { MemoryItemDTO, VocabItemDTO, QuizType } from "@/lib/types";
import {
  getMemoryItems,
  getVocabItems,
  updateMemoryAfterReview,
} from "@/lib/storage";
import {
  buildReviewSession,
  type ReviewSessionItem,
} from "@/lib/session-builder";
import { computeUpdatedHalfLife, estimateRecallProbability } from "@/lib/mastery-engine";

interface ReviewTabProps {
  userId: string;
}

export function ReviewTab({ userId }: ReviewTabProps) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ReviewSessionItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [questionStart, setQuestionStart] = useState<number>(Date.now());
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState<{ correct: number; total: number }>({
    correct: 0,
    total: 0,
  });

  async function loadSession() {
    setLoading(true);
    const [memItems, vocabItems] = await Promise.all([
      getMemoryItems(userId),
      getVocabItems(userId),
    ]);
    const sess = buildReviewSession(memItems, 18);
    setSession(sess);
    setCurrentIdx(0);
    setAnswer("");
    setSubmitted(false);
    setLastCorrect(null);
    setCompleted(false);
    setResults({ correct: 0, total: 0 });
    if (sess.length > 0) setQuestionStart(Date.now());
    setLoading(false);
  }

  useEffect(() => {
    loadSession();
     
  }, [userId]);

  function getVocabForItem(item: MemoryItemDTO, vocabs: VocabItemDTO[]) {
    return vocabs.find((v) => v.memoryItemId === item.id);
  }

  function renderQuestion(item: ReviewSessionItem, vocabs: VocabItemDTO[]) {
    const v = getVocabForItem(item.item, vocabs);
    const format: QuizType = item.chosenFormat;

    if (format === "mcq" && v) {
      // Build options: correct + 3 distractors from other vocab
      const distractors = vocabs
        .filter((x) => x.id !== v?.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((x) => x.definition);
      const options = [v.definition, ...distractors].sort(() => Math.random() - 0.5);
      return (
        <div className="space-y-3">
          <p className="text-sm">
            What does <strong className="text-primary">{v.word}</strong> mean?
          </p>
          <div className="text-xs text-muted-foreground border-l-2 pl-2 italic mb-2">
            "{v.contextSentence}"
          </div>
          <div className="space-y-2">
            {options.map((opt, i) => {
              const isSelected = answer === opt;
              const showCorrect = submitted && opt === v.definition;
              const showWrong = submitted && isSelected && opt !== v.definition;
              return (
                <button
                  key={i}
                  disabled={submitted}
                  onClick={() => setAnswer(opt)}
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
        </div>
      );
    }

    if (format === "cloze" && v) {
      const clozeSentence = v.contextSentence.replace(
        new RegExp(v.word, "i"),
        "_____"
      );
      return (
        <div className="space-y-3">
          <p className="text-sm">Fill in the blank:</p>
          <div className="border-l-2 pl-3 py-1 italic">{clozeSentence}</div>
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitted}
            placeholder="Type the missing word…"
          />
        </div>
      );
    }

    // recall
    if (v) {
      return (
        <div className="space-y-3">
          <p className="text-sm">
            Write the word that matches this definition:
          </p>
          <div className="bg-accent p-3 rounded-md text-sm">
            {v.definition}
          </div>
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitted}
            placeholder="Type the word…"
          />
        </div>
      );
    }

    return <p className="text-sm text-muted-foreground">No vocab item linked.</p>;
  }

  async function handleSubmitAnswer(vocabs: VocabItemDTO[]) {
    if (!session[currentIdx]) return;
    const item = session[currentIdx];
    const v = getVocabForItem(item.item, vocabs);
    if (!v) {
      toast.error("No vocab linked to this item, skipping");
      nextQuestion();
      return;
    }

    const userAns = answer.trim().toLowerCase();
    const correct =
      userAns === v.word.toLowerCase() ||
      userAns === v.definition.trim().toLowerCase();
    const latency = Date.now() - questionStart;
    setLastCorrect(correct);
    setSubmitted(true);
    setResults((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));

    // Update memory model
    const newHalfLife = computeUpdatedHalfLife(item.item, correct, latency);
    await updateMemoryAfterReview(item.item.id, {
      correct,
      latencyMs: latency,
      newHalfLife,
    });

    if (correct) {
      toast.success("Correct! Memory strengthened.");
    } else {
      toast.error(`Wrong. Correct: "${v.word}"`);
    }
  }

  function nextQuestion() {
    if (currentIdx + 1 >= session.length) {
      setCompleted(true);
      toast.success(`Review session complete!`);
      return;
    }
    setCurrentIdx((i) => i + 1);
    setAnswer("");
    setSubmitted(false);
    setLastCorrect(null);
    setQuestionStart(Date.now());
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (session.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <Brain className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">
            No items due for review right now.
          </p>
          <p className="text-xs text-muted-foreground">
            Save some vocabulary from the Read tab, then come back here later when memory decays.
          </p>
          <Button onClick={loadSession} variant="outline">
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (completed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session complete</CardTitle>
          <CardDescription>
            You reviewed {results.total} items.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <div className="text-3xl font-bold">
              {results.correct}/{results.total}
            </div>
            <p className="text-sm text-muted-foreground mt-1">correct</p>
          </div>
          <Progress
            value={results.total > 0 ? (results.correct / results.total) * 100 : 0}
            className="h-2"
          />
          <Button onClick={loadSession} className="w-full">
            <Play className="w-4 h-4 mr-1.5" />
            Start new session
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentItem = session[currentIdx];
  const progress = (currentIdx / session.length) * 100;

  return (
    <ReviewContent
      session={session}
      currentIdx={currentIdx}
      progress={progress}
      userId={userId}
      renderQuestion={renderQuestion}
      onSubmit={handleSubmitAnswer}
      onNext={nextQuestion}
      answer={answer}
      submitted={submitted}
      lastCorrect={lastCorrect}
    />
  );
}

function ReviewContent({
  session,
  currentIdx,
  progress,
  userId,
  renderQuestion,
  onSubmit,
  onNext,
  answer,
  submitted,
  lastCorrect,
}: {
  session: ReviewSessionItem[];
  currentIdx: number;
  progress: number;
  userId: string;
  answer: string;
  submitted: boolean;
  lastCorrect: boolean | null;
  renderQuestion: (item: ReviewSessionItem, vocabs: VocabItemDTO[]) => React.ReactNode;
  onSubmit: (vocabs: VocabItemDTO[]) => Promise<void>;
  onNext: () => void;
}) {
  const [vocabs, setVocabs] = useState<VocabItemDTO[]>([]);

  useEffect(() => {
    getVocabItems(userId).then(setVocabs);
  }, [userId]);

  const currentItem = session[currentIdx];
  const recallProb = estimateRecallProbability(currentItem.item);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              Question {currentIdx + 1} of {session.length}
            </span>
            <Badge variant="outline">Recall: {(recallProb * 100).toFixed(0)}%</Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Review
          </CardTitle>
          <CardDescription>
            Format: <Badge variant="secondary">{currentItem.chosenFormat}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderQuestion(currentItem, vocabs)}

          {submitted && lastCorrect !== null && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              {lastCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
              <span>
                {lastCorrect ? "Correct!" : "Wrong."} Memory model updated.
              </span>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {!submitted ? (
              <Button onClick={() => onSubmit(vocabs)} disabled={!answer.trim()}>
                Submit answer
              </Button>
            ) : (
              <Button onClick={onNext}>
                {currentIdx + 1 >= session.length ? "Finish" : "Next question"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
