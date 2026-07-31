"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Heart, Volume2, Zap, Swords, Timer } from "lucide-react";
import type { FSRSCardState } from "@/lib/types";
import {
  buildQuestions,
  comboMultiplier,
  isTypedAnswerCorrect,
  recordAnswer,
  speakWord,
  type GameQuestion,
  type GameWord,
} from "@/lib/game-engine";
import { award } from "@/lib/gamification";

interface WordBattleProps {
  deckId: string;
  deckName: string;
  words: GameWord[];
  cardStates: Record<string, FSRSCardState>;
  onExit: () => void;
}

const QUESTION_COUNT = 12;
const BOSS_MAX_HP = 100;
const MAX_HEARTS = 3;
const SECONDS_PER_QUESTION = 15;
const BASE_DAMAGE = 11;

type Phase = "playing" | "won" | "lost";

const BOSS_NAME = "Trùm Hải Mã";

export function WordBattle({
  deckId,
  deckName,
  words,
  cardStates,
  onExit,
}: WordBattleProps) {
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [position, setPosition] = useState(0);
  const [bossHp, setBossHp] = useState(BOSS_MAX_HP);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<null | {
    correct: boolean;
    answer: string;
    damage: number;
  }>(null);
  const [phase, setPhase] = useState<Phase>("playing");

  // Chống chấm điểm hai lần cho cùng một câu
  const answeringRef = useRef(false);
  const statesRef = useRef<Record<string, FSRSCardState>>(cardStates);

  const startBattle = useCallback(() => {
    const next = buildQuestions(words, statesRef.current, QUESTION_COUNT);
    setQuestions(next);
    setPosition(0);
    setBossHp(BOSS_MAX_HP);
    setHearts(MAX_HEARTS);
    setCombo(0);
    setBestCombo(0);
    setCorrectCount(0);
    setTimeLeft(SECONDS_PER_QUESTION);
    setTyped("");
    setFeedback(null);
    setPhase("playing");
    answeringRef.current = false;
  }, [words]);

  useEffect(() => {
    startBattle();
  }, [startBattle]);

  const current = questions[position];

  const finish = useCallback(
    (won: boolean) => {
      setPhase(won ? "won" : "lost");
      const { newAchievements } = award(won ? "game-win" : "game-play");
      newAchievements.forEach((a) => {
        toast.success(`🏅 ${a.name}: ${a.description}`, { duration: 5000 });
      });
    },
    []
  );

  const submitAnswer = useCallback(
    async (choice: string | null) => {
      if (!current || phase !== "playing" || answeringRef.current) return;
      answeringRef.current = true;

      const correct =
        choice !== null &&
        (current.kind === "spell"
          ? isTypedAnswerCorrect(choice, current.answer)
          : choice === current.answer);

      const nextCombo = correct ? combo + 1 : 0;
      const multiplier = comboMultiplier(nextCombo);
      const timeBonus = Math.round(timeLeft / 3);
      const damage = correct
        ? Math.round(BASE_DAMAGE * multiplier) + timeBonus
        : 0;

      // Ghi vào lịch ôn — đây là chỗ game biến thành việc học thật
      try {
        const updated = await recordAnswer(
          deckId,
          current.target,
          correct,
          statesRef.current[current.target.word]
        );
        statesRef.current = {
          ...statesRef.current,
          [current.target.word]: updated,
        };
      } catch {
        // không chặn ván chơi nếu localStorage lỗi
      }

      setCombo(nextCombo);
      setBestCombo((b) => Math.max(b, nextCombo));
      setFeedback({ correct, answer: current.answer, damage });

      let nextBossHp = bossHp;
      let nextHearts = hearts;
      if (correct) {
        setCorrectCount((c) => c + 1);
        nextBossHp = Math.max(0, bossHp - damage);
        setBossHp(nextBossHp);
      } else {
        nextHearts = hearts - 1;
        setHearts(nextHearts);
      }

      window.setTimeout(() => {
        answeringRef.current = false;
        setFeedback(null);
        setTyped("");

        if (nextBossHp <= 0) {
          finish(true);
          return;
        }
        if (nextHearts <= 0) {
          finish(false);
          return;
        }
        if (position + 1 >= questions.length) {
          finish(nextBossHp <= 0);
          return;
        }
        setPosition((p) => p + 1);
        setTimeLeft(SECONDS_PER_QUESTION);
      }, 1100);
    },
    [
      bossHp,
      combo,
      current,
      deckId,
      finish,
      hearts,
      phase,
      position,
      questions.length,
      timeLeft,
    ]
  );

  // Đồng hồ từng câu
  useEffect(() => {
    if (phase !== "playing" || feedback || !current) return;
    if (timeLeft <= 0) {
      void submitAnswer(null);
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [timeLeft, phase, feedback, current, submitAnswer]);

  // Tự đọc từ khi gặp câu nghe
  useEffect(() => {
    if (current?.kind === "listen") speakWord(current.target);
  }, [current]);

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center space-y-3">
        <Swords className="w-10 h-10 mx-auto text-muted-foreground" />
        <p className="font-medium">Bộ từ này chưa đủ dữ liệu để đấu</p>
        <p className="text-sm text-muted-foreground">
          Cần ít nhất 4 từ có nghĩa. Thử bộ TOEIC 600 hoặc Daily Conversations.
        </p>
        <button
          onClick={onExit}
          className="px-4 py-2 rounded-lg border font-medium"
        >
          Quay lại
        </button>
      </div>
    );
  }

  if (phase !== "playing") {
    const won = phase === "won";
    return (
      <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
        <div className="text-5xl">{won ? "🏆" : "💀"}</div>
        <h2 className="text-xl font-bold">
          {won ? `Hạ gục ${BOSS_NAME}!` : "Thua rồi"}
        </h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border p-3">
            <div className="text-xl font-bold">{correctCount}</div>
            <div className="text-xs text-muted-foreground">Câu đúng</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xl font-bold">{bestCombo}</div>
            <div className="text-xs text-muted-foreground">Combo cao nhất</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xl font-bold">{BOSS_MAX_HP - bossHp}</div>
            <div className="text-xs text-muted-foreground">Sát thương</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {correctCount} từ vừa được ghi vào lịch ôn của bạn.
        </p>
        <div className="flex gap-2">
          <button
            onClick={startBattle}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium"
          >
            Đấu lại
          </button>
          <button onClick={onExit} className="flex-1 py-3 rounded-xl border font-medium">
            Thoát
          </button>
        </div>
      </div>
    );
  }

  const multiplier = comboMultiplier(combo);

  return (
    <div className="space-y-4">
      {/* Thanh trạng thái */}
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Thoát
        </button>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1">
            {Array.from({ length: MAX_HEARTS }).map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${
                  i < hearts ? "text-rose-500 fill-rose-500" : "text-muted"
                }`}
              />
            ))}
          </span>
          <span
            className={`flex items-center gap-1 tabular-nums ${
              timeLeft <= 5 ? "text-rose-500 font-semibold" : "text-muted-foreground"
            }`}
          >
            <Timer className="w-4 h-4" />
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Boss */}
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐲</span>
            <div>
              <p className="font-semibold leading-tight">{BOSS_NAME}</p>
              <p className="text-xs text-muted-foreground">{deckName}</p>
            </div>
          </div>
          <span className="text-sm tabular-nums text-muted-foreground">
            {bossHp} / {BOSS_MAX_HP}
          </span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-rose-500 transition-all duration-300"
            style={{ width: `${(bossHp / BOSS_MAX_HP) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Câu {position + 1} / {questions.length}
          </span>
          {combo >= 3 && (
            <span className="flex items-center gap-1 text-amber-500 font-semibold">
              <Zap className="w-3.5 h-3.5" />
              Combo {combo} · x{multiplier}
            </span>
          )}
        </div>
      </div>

      {/* Câu hỏi */}
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <p className="text-xs text-muted-foreground text-center">
          {current.kind === "listen" && "Nghe và chọn từ đúng"}
          {current.kind === "spell" && "Gõ từ tiếng Anh đúng nghĩa"}
          {current.kind === "meaning-to-word" && "Nghĩa này là từ nào?"}
          {current.kind === "word-to-meaning" && "Từ này nghĩa là gì?"}
        </p>

        {current.kind === "listen" ? (
          <div className="flex justify-center">
            <button
              onClick={() => speakWord(current.target)}
              className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              aria-label="Nghe lại"
            >
              <Volume2 className="w-7 h-7" />
            </button>
          </div>
        ) : (
          <p className="text-center text-xl font-semibold">{current.prompt}</p>
        )}

        {feedback && (
          <div
            className={`rounded-lg p-3 text-center text-sm ${
              feedback.correct
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            }`}
          >
            {feedback.correct
              ? `Chính xác! −${feedback.damage} HP`
              : `Sai rồi — đáp án: ${feedback.answer}`}
          </div>
        )}

        {current.kind === "spell" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitAnswer(typed);
            }}
            className="space-y-2"
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={!!feedback}
              autoFocus
              placeholder="Gõ từ tiếng Anh…"
              className="w-full px-4 py-3 rounded-lg border bg-transparent text-center text-lg outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!typed.trim() || !!feedback}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              Tấn công
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {current.options.map((option) => (
              <button
                key={option}
                disabled={!!feedback}
                onClick={() => void submitAnswer(option)}
                className="w-full px-4 py-3 rounded-lg border text-left text-sm hover:bg-accent disabled:opacity-60 transition-colors"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
