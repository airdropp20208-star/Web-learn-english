"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Brain, Clock } from "lucide-react";
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

const PAIRS = 6;
const ROUNDS = 2;
const TOTAL_SECONDS = 120;

interface MemoryCard {
  id: number;
  pairIdx: number;
  kind: "word" | "meaning";
  text: string;
}

interface MemoryFlipProps {
  deckId: string;
  words: GameWord[];
  cardStates: Record<string, FSRSCardState>;
  onExit: () => void;
}

/**
 * Lật thẻ trí nhớ: 12 thẻ úp, lật 2 thẻ mỗi lượt để ghép từ với nghĩa.
 * Vừa luyện nghĩa vừa luyện trí nhớ vị trí.
 */
export function MemoryFlip({
  deckId,
  words,
  cardStates,
  onExit,
}: MemoryFlipProps) {
  const statesRef = useRef(cardStates);
  const exitRef = useRef(onExit);
  useEffect(() => {
    exitRef.current = onExit;
  }, [onExit]);

  const usableWords = useMemo(
    () => words.filter((w) => meaningOf(w)),
    [words]
  );

  const [round, setRound] = useState(0);
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [roundWords, setRoundWords] = useState<GameWord[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  // Hết giờ là hết ván — suy ra chứ không lưu riêng. Chỉ việc chơi hết số
  // vòng mới cần một biến state.
  const [clearedAllRounds, setClearedAllRounds] = useState(false);
  const gameOver = clearedAllRounds || timeLeft <= 0;

  // Sinh bàn chơi đúng một lần mỗi vòng. Mọi thứ khác đọc qua ref để
  // không bao giờ bị dựng lại giữa ván.
  useEffect(() => {
    if (usableWords.length < PAIRS) {
      toast.error(`Bộ từ này cần ít nhất ${PAIRS} từ có nghĩa`);
      exitRef.current();
      return;
    }
    if (round >= ROUNDS) return;

    const picked = pickWords(usableWords, statesRef.current, PAIRS);
    const built: MemoryCard[] = [];
    picked.forEach((w, i) => {
      built.push({ id: i * 2, pairIdx: i, kind: "word", text: w.word });
      built.push({
        id: i * 2 + 1,
        pairIdx: i,
        kind: "meaning",
        text: truncate(meaningOf(w) as string, 48),
      });
    });

    setRoundWords(picked);
    setCards(shuffle(built));
    setFlipped([]);
    setMatched([]);
  }, [round, usableWords]);

  // Đồng hồ ván
  useEffect(() => {
    if (gameOver) return;
    const timer = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [timeLeft, gameOver]);

  /**
   * Kết thúc một vòng: cộng điểm, sang vòng sau (hoặc kết thúc ván).
   *
   * Bản cũ để việc này trong một effect theo dõi `matched`, kèm một
   * `eslint-disable` để nó đừng đòi thêm dependency. Effect đó chạy SAU khi
   * lật xong nên tiền thưởng thời gian bị tính ở giây kế tiếp; gọi thẳng từ
   * chỗ cặp cuối cùng khớp vừa đúng vừa bớt được một vòng vẽ.
   */
  function completeRound() {
    setScore((s) => s + 100 + timeLeft);
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound < ROUNDS) return;

    setClearedAllRounds(true);
    const { newAchievements } = award("game-win");
    toast.success(getGameComment(true), { duration: 3000 });
    newAchievements.forEach((a) => {
      toast.success(`🏅 ${a.name}: ${a.description}`, { duration: 5000 });
    });
  }

  function handleFlip(card: MemoryCard) {
    if (gameOver) return;
    if (flipped.length >= 2) return;
    if (flipped.includes(card.id) || matched.includes(card.id)) return;

    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length < 2) return;

    setMoves((m) => m + 1);
    const first = cards.find((c) => c.id === next[0]);
    const second = cards.find((c) => c.id === next[1]);
    if (!first || !second) return;

    const isMatch = first.pairIdx === second.pairIdx;
    const word = roundWords[first.pairIdx];
    if (word) {
      void recordAnswer(deckId, word, isMatch, statesRef.current[word.word]);
    }

    if (isMatch) {
      const lastPair = matched.length + 2 >= cards.length;
      window.setTimeout(() => {
        setMatched((m) => [...m, first.id, second.id]);
        setFlipped([]);
        if (lastPair) completeRound();
      }, 350);
    } else {
      window.setTimeout(() => setFlipped([]), 800);
    }
  }

  if (gameOver) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center space-y-4 max-w-md mx-auto">
        <Brain className="w-12 h-12 mx-auto text-indigo-500" />
        <div>
          <div className="text-3xl font-bold">{score}</div>
          <p className="text-sm text-muted-foreground">
            điểm · {moves} lượt lật
          </p>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={onExit}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Thoát
        </button>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>
            Vòng {Math.min(round + 1, ROUNDS)}/{ROUNDS}
          </span>
          <span>{moves} lượt</span>
          <span
            className={`inline-flex items-center gap-1 tabular-nums ${
              timeLeft <= 15 ? "text-rose-500 font-semibold" : ""
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {timeLeft}s
          </span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Lật 2 thẻ để ghép từ với nghĩa của nó
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {cards.map((card) => {
          const isMatched = matched.includes(card.id);
          const isFlipped = flipped.includes(card.id) || isMatched;
          return (
            <button
              key={card.id}
              onClick={() => handleFlip(card)}
              disabled={isMatched}
              className={`h-24 rounded-xl border p-2 text-xs leading-tight transition-all ${
                isMatched
                  ? "bg-emerald-100 dark:bg-emerald-950 border-emerald-300 opacity-60"
                  : isFlipped
                    ? "bg-card border-primary"
                    : "bg-brand text-white border-transparent hover:-translate-y-0.5"
              }`}
            >
              {isFlipped ? (
                <span
                  className={card.kind === "word" ? "font-bold text-sm" : ""}
                >
                  {card.text}
                </span>
              ) : (
                <span className="text-xl">?</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
