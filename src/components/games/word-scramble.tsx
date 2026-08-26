"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Delete, Lightbulb, Shuffle, X } from "lucide-react";
import type { FSRSCardState } from "@/lib/types";
import {
  meaningOf,
  pickWords,
  recordAnswer,
  shuffle,
  speakWord,
  type GameWord,
} from "@/lib/game-engine";
import { award } from "@/lib/gamification";
import { getGameComment } from "@/lib/humor";

const WORD_COUNT = 8;

interface WordScrambleProps {
  deckId: string;
  words: GameWord[];
  cardStates: Record<string, FSRSCardState>;
  onExit: () => void;
}

/**
 * Xáo chữ cái của một từ, đảm bảo kết quả KHÁC thứ tự gốc.
 *
 * Ở ngoài component vì nó chỉ phụ thuộc đối số truyền vào — nhờ vậy gọi được
 * cả trong `useState` khởi tạo lẫn trong handler chuyển từ, thay vì phải nhốt
 * trong một effect theo dõi `idx`.
 */
function scrambleWord(word: GameWord | undefined): string[] {
  if (!word) return [];
  const chars = word.word.toLowerCase().split("");
  let scrambled = shuffle(chars);
  if (scrambled.join("") === chars.join("") && chars.length > 1) {
    scrambled = [...scrambled.slice(1), scrambled[0]];
  }
  return scrambled;
}

/**
 * Xếp chữ: cho nghĩa tiếng Việt/Anh, người chơi ghép các chữ cái bị xáo
 * thành từ đúng. Luyện nhớ mặt chữ chứ không chỉ nhận ra từ.
 */
export function WordScramble({
  deckId,
  words,
  cardStates,
  onExit,
}: WordScrambleProps) {
  // Ảnh chụp trạng thái thẻ lúc bắt đầu ván, cố định tới hết ván.
  //
  // Bản cũ dùng `useRef(cardStates)` rồi đọc `.current` ngay trong thân
  // component — đọc ref lúc vẽ là thứ React Compiler không đảm bảo được. Ref
  // này lại chẳng bao giờ được cập nhật, nên nó chỉ đang làm đúng việc mà
  // `useState` đã làm sẵn: giữ nguyên giá trị đầu tiên.
  const [initialStates] = useState(cardStates);

  // Chỉ lấy từ đơn thuần chữ cái, đủ ngắn để xếp trên điện thoại
  const [pool] = useState<GameWord[]>(() =>
    pickWords(
      words.filter((w) => meaningOf(w) && /^[a-zA-Z]{3,12}$/.test(w.word)),
      initialStates,
      WORD_COUNT
    )
  );

  const [idx, setIdx] = useState(0);
  const [letters, setLetters] = useState<string[]>(() => scrambleWord(pool[0]));
  const [slots, setSlots] = useState<number[]>([]);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = pool[idx];

  /**
   * Người chơi chọn một chữ cái.
   *
   * Việc chấm bài nằm ngay đây chứ không ở một effect theo dõi `slots`: đúng
   * lúc ô cuối cùng được lấp thì đã biết đáp án, không cần chờ thêm một vòng
   * vẽ nữa. Bản cũ để trong effect nên còn phải tự canh `result !== null` để
   * khỏi chấm hai lần.
   */
  function handlePickLetter(i: number) {
    if (usedSet.has(i) || result !== null || revealed || !current) return;

    const nextSlots = [...slots, i];
    setSlots(nextSlots);
    if (nextSlots.length !== letters.length) return;

    const guess = nextSlots.map((k) => letters[k]).join("");
    const ok = guess === current.word.toLowerCase();
    setResult(ok ? "correct" : "wrong");
    if (ok) {
      setScore((s) => s + 1);
      speakWord(current);
    }
    void recordAnswer(deckId, current, ok, initialStates[current.word]);
  }

  function handleNext() {
    if (idx + 1 >= pool.length) {
      setFinished(true);
      const won = score >= Math.ceil(pool.length / 2);
      const { newAchievements } = award(won ? "game-win" : "game-play");
      toast.success(getGameComment(won), { duration: 3000 });
      newAchievements.forEach((a) => {
        toast.success(`🏅 ${a.name}: ${a.description}`, { duration: 5000 });
      });
      return;
    }
    const next = idx + 1;
    setIdx(next);
    setLetters(scrambleWord(pool[next]));
    setSlots([]);
    setResult(null);
    setRevealed(false);
  }

  function handleReveal() {
    if (!current || result !== null) return;
    setRevealed(true);
    void recordAnswer(deckId, current, false, initialStates[current.word]);
  }

  if (pool.length === 0) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card card-elevated p-8 text-center space-y-4 max-w-md mx-auto">
        <p className="text-sm text-muted-foreground">
          Bộ từ này chưa có từ nào phù hợp để xếp chữ.
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
    return (
      <div className="rounded-2xl border border-border/70 bg-card card-elevated p-8 text-center space-y-4 max-w-md mx-auto">
        <div className="text-4xl">
          {score >= Math.ceil(pool.length / 2) ? "🎉" : "💪"}
        </div>
        <div>
          <div className="text-3xl font-bold">
            {score}/{pool.length}
          </div>
          <p className="text-sm text-muted-foreground">xếp đúng</p>
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

  const usedSet = new Set(slots);
  const answerShown = result !== null || revealed;

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={onExit}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Thoát
        </button>
        <span className="text-muted-foreground">
          {idx + 1}/{pool.length} · {score} đúng
        </span>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card card-elevated p-6 space-y-5">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">
            Xếp các chữ cái thành từ có nghĩa
          </p>
          <p className="font-semibold leading-snug">{meaningOf(current)}</p>
        </div>

        {/* Ô đáp án */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {letters.map((_, position) => {
            const letterIdx = slots[position];
            const filled = letterIdx !== undefined;
            return (
              <div
                key={position}
                className={`w-9 h-11 rounded-lg border-2 flex items-center justify-center text-lg font-bold uppercase ${
                  answerShown
                    ? result === "correct"
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950"
                      : "border-rose-400 bg-rose-50 dark:bg-rose-950"
                    : filled
                      ? "border-primary bg-primary/10"
                      : "border-dashed border-border"
                }`}
              >
                {filled ? letters[letterIdx] : ""}
              </div>
            );
          })}
        </div>

        {answerShown && (
          <div
            className={`rounded-xl p-3 text-center text-sm ${
              result === "correct"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            }`}
          >
            {result === "correct" ? (
              <span className="inline-flex items-center gap-1">
                <Check className="w-4 h-4" /> Chính xác
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <X className="w-4 h-4" /> Đáp án: <strong>{current.word}</strong>
              </span>
            )}
          </div>
        )}

        {/* Chữ cái để chọn */}
        {!answerShown && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {letters.map((ch, i) => (
              <button
                key={`${ch}-${i}`}
                onClick={() => handlePickLetter(i)}
                disabled={usedSet.has(i)}
                className={`w-9 h-11 rounded-lg border text-lg font-bold uppercase transition-all ${
                  usedSet.has(i)
                    ? "opacity-25"
                    : "bg-card hover:border-primary hover:-translate-y-0.5"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        )}

        {!answerShown ? (
          <div className="flex gap-2">
            <button
              onClick={() => setSlots((s) => s.slice(0, -1))}
              disabled={slots.length === 0}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            >
              <Delete className="w-4 h-4" /> Xoá
            </button>
            <button
              onClick={() => setSlots([])}
              disabled={slots.length === 0}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            >
              <Shuffle className="w-4 h-4" /> Làm lại
            </button>
            <button
              onClick={handleReveal}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium inline-flex items-center justify-center gap-1.5"
            >
              <Lightbulb className="w-4 h-4" /> Chịu
            </button>
          </div>
        ) : (
          <button
            onClick={handleNext}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
          >
            {idx + 1 >= pool.length ? "Kết thúc" : "Từ tiếp theo"}
          </button>
        )}
      </div>
    </div>
  );
}
