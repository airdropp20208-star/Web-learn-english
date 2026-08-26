"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, ThumbsDown, ThumbsUp, X } from "lucide-react";
import type { FSRSCardState } from "@/lib/types";
import {
  meaningOf,
  pickWords,
  recordAnswer,
  shuffle,
  type GameWord,
} from "@/lib/game-engine";
import { award } from "@/lib/gamification";
import { getGameComment } from "@/lib/humor";

const ITEM_COUNT = 20;
const TOTAL_SECONDS = 60;

interface TrueFalseItem {
  word: GameWord;
  shownMeaning: string;
  isTrue: boolean;
}

interface TrueFalseProps {
  deckId: string;
  words: GameWord[];
  cardStates: Record<string, FSRSCardState>;
  onExit: () => void;
}

/**
 * Đúng hay Sai: hiện một cặp từ - nghĩa, người chơi quyết định cặp đó có
 * khớp không. Nhanh, dễ chơi, ép nhớ nghĩa chính xác thay vì đoán mò.
 */
export function TrueFalse({
  deckId,
  words,
  cardStates,
  onExit,
}: TrueFalseProps) {
  // Ảnh chụp trạng thái thẻ lúc bắt đầu ván, cố định tới hết ván.
  //
  // Bản cũ dùng `useRef(cardStates)` rồi đọc `.current` ngay trong thân
  // component — đọc ref lúc vẽ là thứ React Compiler không đảm bảo được. Ref
  // này lại chẳng bao giờ được cập nhật, nên nó chỉ đang làm đúng việc mà
  // `useState` đã làm sẵn: giữ nguyên giá trị đầu tiên.
  const [initialStates] = useState(cardStates);

  // Sinh toàn bộ câu hỏi một lần khi vào ván
  const [items] = useState<TrueFalseItem[]>(() => {
    const usable = words.filter((w) => meaningOf(w));
    if (usable.length < 4) return [];
    const picked = pickWords(usable, initialStates, ITEM_COUNT);
    return picked.map((word) => {
      const own = meaningOf(word) as string;
      const useOwn = Math.random() < 0.5;
      if (useOwn) return { word, shownMeaning: own, isTrue: true };

      const others = shuffle(
        usable.filter((w) => w.word !== word.word && meaningOf(w) !== own)
      );
      const decoy = others[0];
      if (!decoy) return { word, shownMeaning: own, isTrue: true };
      return {
        word,
        shownMeaning: meaningOf(decoy) as string,
        isTrue: false,
      };
    });
  });

  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [endedEarly, setEndedEarly] = useState(false);
  const finished = endedEarly || timeLeft <= 0;

  const current = items[idx];

  useEffect(() => {
    if (finished) return;
    const timer = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [timeLeft, finished]);

  const awardedRef = useRef(false);
  useEffect(() => {
    if (!finished || awardedRef.current) return;
    awardedRef.current = true;
    const won = correctCount >= Math.ceil(items.length / 2);
    const { newAchievements } = award(won ? "game-win" : "game-play");
    toast.success(getGameComment(won), { duration: 3000 });
    newAchievements.forEach((a) => {
      toast.success(`🏅 ${a.name}: ${a.description}`, { duration: 5000 });
    });
  }, [finished, correctCount, items.length]);

  function answer(said: boolean) {
    if (!current || feedback !== null || finished) return;
    const correct = said === current.isTrue;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) {
      setCorrectCount((c) => c + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }

    // Chỉ ghi vào lịch ôn khi cặp hiện ra là cặp đúng — trả lời "sai" cho một
    // cặp ghép bừa không chứng minh được người học nhớ nghĩa của từ đó.
    if (current.isTrue) {
      void recordAnswer(
        deckId,
        current.word,
        correct,
        initialStates[current.word.word]
      );
    }

    window.setTimeout(() => {
      setFeedback(null);
      setIdx((i) => {
        if (i + 1 >= items.length) {
          setEndedEarly(true);
          return i;
        }
        return i + 1;
      });
    }, 500);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card card-elevated p-8 text-center space-y-4 max-w-md mx-auto">
        <p className="text-sm text-muted-foreground">
          Bộ từ này chưa đủ từ có nghĩa để chơi.
        </p>
        <button
          onClick={onExit}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
        >
          Quay lại
        </button>
      </div>
    );
  }

  if (finished) {
    const won = correctCount >= Math.ceil(items.length / 2);
    return (
      <div className="rounded-2xl border border-border/70 bg-card card-elevated p-8 text-center space-y-4 max-w-md mx-auto">
        <div className="text-4xl">{won ? "🎉" : "💪"}</div>
        <div>
          <div className="text-3xl font-bold">
            {correctCount}/{items.length}
          </div>
          <p className="text-sm text-muted-foreground">phán đoán đúng</p>
        </div>
        <button
          onClick={onExit}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
        >
          Quay lại
        </button>
      </div>
    );
  }

  if (!current) return <div className="h-40 rounded-xl bg-muted animate-pulse" />;

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={onExit}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Thoát
        </button>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>
            {idx + 1}/{items.length}
          </span>
          {streak >= 3 && (
            <span className="text-orange-500 font-semibold">🔥 {streak}</span>
          )}
          <span
            className={`inline-flex items-center gap-1 tabular-nums ${
              timeLeft <= 10 ? "text-rose-500 font-bold" : ""
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {timeLeft}s
          </span>
        </div>
      </div>

      <div
        className={`rounded-2xl border-2 bg-card p-6 text-center space-y-3 transition-colors ${
          feedback === "correct"
            ? "border-emerald-400"
            : feedback === "wrong"
              ? "border-rose-400"
              : "border-border"
        }`}
      >
        <p className="text-xs text-muted-foreground">Cặp này có khớp không?</p>
        <p className="text-2xl font-bold">{current.word.word}</p>
        <div className="h-px bg-border" />
        <p className="text-base leading-snug">{current.shownMeaning}</p>

        {feedback && (
          <p
            className={`text-sm font-medium inline-flex items-center gap-1 ${
              feedback === "correct" ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {feedback === "correct" ? (
              <>
                <Check className="w-4 h-4" /> Chuẩn
              </>
            ) : (
              <>
                <X className="w-4 h-4" /> Sai rồi — cặp này{" "}
                {current.isTrue ? "khớp" : "không khớp"}
              </>
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => answer(false)}
          disabled={feedback !== null}
          className="py-4 rounded-2xl border-2 border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ThumbsDown className="w-5 h-5" /> Không khớp
        </button>
        <button
          onClick={() => answer(true)}
          disabled={feedback !== null}
          className="py-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ThumbsUp className="w-5 h-5" /> Khớp
        </button>
      </div>
    </div>
  );
}
