"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { Brain, CheckCircle2, RotateCcw, Play } from "lucide-react";
import { PronounceButton } from "@/components/pronounce-button";
import type { MemoryItemDTO, VocabItemDTO, QuizType } from "@/lib/types";
import { getMemoryItems, getVocabItems, reviewMemoryItem } from "@/lib/storage";
import { buildReviewSession, type ReviewSessionItem } from "@/lib/session-builder";
import {
  previewSchedule,
  formatInterval,
  fromCardState,
  type ReviewRating,
} from "@/lib/fsrs";
import { Rating } from "ts-fsrs";
import { estimateRecallProbability } from "@/lib/mastery-engine";
import { award } from "@/lib/gamification";
import { getReviewComment } from "@/lib/humor";

interface ReviewTabProps {
  userId: string;
}

const RATING_BUTTONS: Array<{
  rating: ReviewRating;
  label: string;
  color: string;
  key: string;
}> = [
  // Giá trị enum thật: Again=1, Hard=2, Good=3, Easy=4. Bản cũ gõ số trần
  // 2/3/4/5 theo một comment sai, khiến MỌI nút gửi đi mức cao hơn một bậc
  // và nút "Easy" gửi 5 — nằm ngoài dải hợp lệ.
  { rating: Rating.Again, label: "Again", color: "bg-red-500 hover:bg-red-600 text-white", key: "1" },
  { rating: Rating.Hard, label: "Hard", color: "bg-orange-500 hover:bg-orange-600 text-white", key: "2" },
  { rating: Rating.Good, label: "Good", color: "bg-green-500 hover:bg-green-600 text-white", key: "3" },
  { rating: Rating.Easy, label: "Easy", color: "bg-blue-500 hover:bg-blue-600 text-white", key: "4" },
];

export function ReviewTab({ userId }: ReviewTabProps) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ReviewSessionItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState<{ reviewed: number; again: number }>({
    reviewed: 0,
    again: 0,
  });
  const [vocabs, setVocabs] = useState<VocabItemDTO[]>([]);

  async function loadSession() {
    setLoading(true);
    const [memItems, vocabItems] = await Promise.all([
      getMemoryItems(userId),
      getVocabItems(userId),
    ]);
    setVocabs(vocabItems);
    const sess = buildReviewSession(memItems, 18);
    setSession(sess);
    setCurrentIdx(0);
    setAnswer("");
    setShowAnswer(false);
    setCompleted(false);
    setResults({ reviewed: 0, again: 0 });
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [memItems, vocabItems] = await Promise.all([
        getMemoryItems(userId),
        getVocabItems(userId),
      ]);
      if (cancelled) return;
      setVocabs(vocabItems);
      const sess = buildReviewSession(memItems, 18);
      setSession(sess);
      setCurrentIdx(0);
      setAnswer("");
      setShowAnswer(false);
      setCompleted(false);
      setResults({ reviewed: 0, again: 0 });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function getVocabForItem(item: MemoryItemDTO): VocabItemDTO | undefined {
    return vocabs.find((v) => v.memoryItemId === item.id);
  }

  function renderQuestion(item: ReviewSessionItem) {
    const v = getVocabForItem(item.item);
    if (!v) return <p className="text-sm text-muted-foreground">No vocab linked.</p>;

    const format: QuizType = item.chosenFormat;

    if (format === "mcq") {
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
          {v.ipa && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{v.ipa}</span>
              <PronounceButton word={v.word} audioUrl={v.audioUrl} />
            </div>
          )}
          <div className="text-xs text-muted-foreground border-l-2 pl-2 italic mb-2">
            "{v.contextSentence}"
          </div>
          {showAnswer ? (
            <div className="bg-emerald-50 dark:bg-emerald-950 p-3 rounded-md text-sm">
              <strong>Answer:</strong> {v.definition}
            </div>
          ) : (
            <div className="space-y-2">
              {options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setAnswer(opt)}
                  className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                    answer === opt
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (format === "cloze") {
      const clozeSentence = v.contextSentence.replace(
        new RegExp(v.word, "i"),
        "_____"
      );
      return (
        <div className="space-y-3">
          <p className="text-sm">Fill in the blank:</p>
          <div className="border-l-2 pl-3 py-1 italic">{clozeSentence}</div>
          {showAnswer ? (
            <div className="bg-emerald-50 dark:bg-emerald-950 p-3 rounded-md text-sm">
              <strong>Answer:</strong> {v.word}
              {v.ipa && <span className="ml-2 font-mono text-xs">{v.ipa}</span>}
            </div>
          ) : (
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type the missing word…"
              onKeyDown={(e) => {
                if (e.key === "Enter") setShowAnswer(true);
              }}
            />
          )}
        </div>
      );
    }

    // recall
    return (
      <div className="space-y-3">
        <p className="text-sm">Write the word that matches this definition:</p>
        <div className="bg-accent p-3 rounded-md text-sm">{v.definition}</div>
        {showAnswer ? (
          <div className="bg-emerald-50 dark:bg-emerald-950 p-3 rounded-md text-sm">
            <strong>Answer:</strong> {v.word}
            {v.ipa && <span className="ml-2 font-mono text-xs">{v.ipa}</span>}
            <PronounceButton
              word={v.word}
              audioUrl={v.audioUrl}
              className="ml-2 align-middle"
            />
          </div>
        ) : (
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type the word…"
            onKeyDown={(e) => {
              if (e.key === "Enter") setShowAnswer(true);
            }}
          />
        )}
      </div>
    );
  }

  async function handleReview(rating: ReviewRating) {
    if (!session[currentIdx]) return;
    const item = session[currentIdx];

    await reviewMemoryItem(userId, item.item.id, rating);

    setResults((prev) => ({
      reviewed: prev.reviewed + 1,
      again: prev.again + (rating === Rating.Again ? 1 : 0),
    }));

    // Award gamification — review-word gives XP + coins
    const correct = rating !== Rating.Again;
    const { newAchievements } = award("review-word");
    toast.success(getReviewComment(correct), { duration: 2500 });
    newAchievements.forEach((a) => {
      toast.success(`🏅 ${a.name}: ${a.description}`, { duration: 5000 });
    });

    if (rating === Rating.Again) {
      toast.info("Sẽ ôn lại sớm", { duration: 2000 });
    }

    // Next question
    if (currentIdx + 1 >= session.length) {
      setCompleted(true);
      toast.success("Review session complete!");
      return;
    }
    setCurrentIdx((i) => i + 1);
    setAnswer("");
    setShowAnswer(false);
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
          <p className="text-muted-foreground">No items due for review right now.</p>
          <p className="text-xs text-muted-foreground">
            Save vocabulary from the Read tab, then come back when cards are due.
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
            You reviewed {results.reviewed} cards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <div className="text-3xl font-bold">{results.reviewed}</div>
            <p className="text-sm text-muted-foreground mt-1">cards reviewed</p>
            {results.again > 0 && (
              <p className="text-xs text-orange-600 mt-2">
                {results.again} marked "Again" (will review soon)
              </p>
            )}
          </div>
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
  const preview = previewSchedule(fromCardState(currentItem.item.card));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              Card {currentIdx + 1} of {session.length}
            </span>
            <Badge variant="outline">
              {currentItem.chosenFormat}
            </Badge>
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
        </CardHeader>
        <CardContent>
          {renderQuestion(currentItem)}

          {!showAnswer ? (
            <Button
              onClick={() => setShowAnswer(true)}
              className="w-full mt-4"
              size="lg"
            >
              Show answer
            </Button>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-center text-muted-foreground mb-2">
                How well did you remember?
              </p>
              <div className="grid grid-cols-4 gap-2">
                {RATING_BUTTONS.map((btn) => (
                  <button
                    key={btn.rating}
                    onClick={() => handleReview(btn.rating)}
                    className={`px-3 py-3 rounded-md text-sm font-medium transition-colors ${btn.color}`}
                  >
                    <div>{btn.label}</div>
                    <div className="text-xs opacity-80 mt-0.5">
                      {formatInterval(preview[btn.label.toLowerCase() as "again" | "hard" | "good" | "easy"].intervalDays)}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Press 1-4 to select, or click buttons above
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
