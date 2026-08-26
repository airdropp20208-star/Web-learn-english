"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, Flame, X, Zap } from "lucide-react";
import type { FSRSCardState } from "@/lib/types";
import {
  buildQuestions,
  comboMultiplier,
  recordAnswer,
  type GameQuestion,
  type GameWord,
} from "@/lib/game-engine";
import { award } from "@/lib/gamification";
import { getGameComment } from "@/lib/humor";

const TOTAL_SECONDS = 60;
const QUESTION_COUNT = 40;
const WIN_THRESHOLD = 12;

interface SpeedQuizProps {
  deckId: string;
  words: GameWord[];
  cardStates: Record<string, FSRSCardState>;
  onExit: () => void;
}

/**
 * Tốc chiến: trả lời càng nhanh càng nhiều trong 60 giây.
 * Chuỗi đúng liên tiếp nhân điểm (combo).
 */
export function SpeedQuiz({ deckId, words, cardStates, onExit }: SpeedQuizProps) {
  // Ảnh chụp trạng thái thẻ lúc bắt đầu ván, cố định tới hết ván.
  //
  // Bản cũ dùng `useRef(cardStates)` rồi đọc `.current` ngay trong thân
  // component — đọc ref lúc vẽ là thứ React Compiler không đảm bảo được. Ref
  // này lại chẳng bao giờ được cập nhật, nên nó chỉ đang làm đúng việc mà
  // `useState` đã làm sẵn: giữ nguyên giá trị đầu tiên.
  const [initialStates] = useState(cardStates);

  // Sinh bộ câu hỏi đúng một lần khi vào ván
  const [questions] = useState<GameQuestion[]>(() =>
    buildQuestions(words, initialStates, QUESTION_COUNT, [
      "meaning-to-word",
      "word-to-meaning",
    ])
  );

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [endedEarly, setEndedEarly] = useState(false);
  const finished = endedEarly || timeLeft <= 0;

  const current = questions[idx];

  // Đồng hồ ván
  useEffect(() => {
    if (finished) return;
    const timer = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [timeLeft, finished]);

  // Trao thưởng đúng một lần khi kết thúc
  const awardedRef = useRef(false);
  useEffect(() => {
    if (!finished || awardedRef.current) return;
    awardedRef.current = true;
    const won = correctCount >= WIN_THRESHOLD;
    const { newAchievements } = award(won ? "game-win" : "game-play");
    toast.success(getGameComment(won), { duration: 3000 });
    newAchievements.forEach((a) => {
      toast.success(`🏅 ${a.name}: ${a.description}`, { duration: 5000 });
    });
  }, [finished, correctCount]);

  function pick(option: string) {
    if (picked !== null || !current || finished) return;
    const correct = option === current.answer;
    setPicked(option);

    if (correct) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setBestCombo((b) => Math.max(b, nextCombo));
      setScore((s) => s + Math.round(10 * comboMultiplier(combo)));
      setCorrectCount((c) => c + 1);
    } else {
      setCombo(0);
    }

    void recordAnswer(
      deckId,
      current.target,
      correct,
      initialStates[current.target.word]
    );

    window.setTimeout(() => {
      setPicked(null);
      setIdx((i) => {
        if (i + 1 >= questions.length) {
          setEndedEarly(true);
          return i;
        }
        return i + 1;
      });
    }, 450);
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        message="Bộ từ này chưa đủ dữ liệu nghĩa để tạo câu hỏi."
        onExit={onExit}
      />
    );
  }

  if (finished) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center space-y-4 max-w-md mx-auto">
        <Zap className="w-12 h-12 mx-auto text-amber-500" />
        <div>
          <div className="text-4xl font-bold">{score}</div>
          <p className="text-sm text-muted-foreground">điểm</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted p-3">
            <div className="font-bold text-lg">{correctCount}</div>
            <div className="text-muted-foreground text-xs">câu đúng</div>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <div className="font-bold text-lg">x{bestCombo}</div>
            <div className="text-muted-foreground text-xs">chuỗi dài nhất</div>
          </div>
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
        <div className="flex items-center gap-3">
          {combo >= 3 && (
            <span className="inline-flex items-center gap-1 text-orange-500 font-semibold">
              <Flame className="w-3.5 h-3.5" />x{comboMultiplier(combo)}
            </span>
          )}
          <span className="font-semibold tabular-nums">{score}</span>
          <span
            className={`inline-flex items-center gap-1 tabular-nums ${
              timeLeft <= 10 ? "text-rose-500 font-bold" : "text-muted-foreground"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Thanh thời gian */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-brand transition-all duration-1000 ease-linear"
          style={{ width: `${(timeLeft / TOTAL_SECONDS) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <p className="text-xs text-muted-foreground text-center mb-2">
          {current.kind === "meaning-to-word" ? "Nghĩa này là từ nào?" : "Từ này nghĩa là gì?"}
        </p>
        <p className="text-center text-lg font-semibold mb-5 leading-snug">
          {current.prompt}
        </p>

        <div className="space-y-2">
          {current.options.map((opt) => {
            const isAnswer = opt === current.answer;
            const isPicked = opt === picked;
            let cls = "hover:bg-accent border";
            if (picked !== null) {
              if (isAnswer)
                cls =
                  "bg-emerald-100 dark:bg-emerald-950 border-emerald-400 border";
              else if (isPicked)
                cls = "bg-rose-100 dark:bg-rose-950 border-rose-400 border";
              else cls = "border opacity-50";
            }
            return (
              <button
                key={opt}
                onClick={() => pick(opt)}
                disabled={picked !== null}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${cls}`}
              >
                <span className="inline-flex items-center gap-2">
                  {picked !== null && isAnswer && (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  {picked !== null && isPicked && !isAnswer && (
                    <X className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  {opt}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  message,
  onExit,
}: {
  message: string;
  onExit: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center space-y-4 max-w-md mx-auto">
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        onClick={onExit}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
      >
        Quay lại
      </button>
    </div>
  );
}
