"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, X, RotateCcw } from "lucide-react";
import type {
  FoundationExercise,
  FoundationLesson,
} from "@/lib/foundation-lessons";

interface Props {
  lesson: FoundationLesson;
  onExit: () => void;
  /** Gọi khi làm xong toàn bộ bài tập, kèm điểm phần trăm. */
  onFinish: (scorePercent: number) => void;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[.?!,]/g, "").replace(/\s+/g, " ");
}

export function FoundationLessonPlayer({ lesson, onExit, onFinish }: Props) {
  const [phase, setPhase] = useState<"theory" | "quiz" | "done">("theory");
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const total = lesson.exercises.length;
  const scorePercent = total === 0 ? 100 : Math.round((correctCount / total) * 100);

  function handleAnswer(isCorrect: boolean) {
    if (isCorrect) setCorrectCount((c) => c + 1);
  }

  function handleNext() {
    if (index + 1 >= total) {
      const finalScore =
        total === 0 ? 100 : Math.round((correctCount / total) * 100);
      setPhase("done");
      onFinish(finalScore);
    } else {
      setIndex((i) => i + 1);
    }
  }

  function restart() {
    setIndex(0);
    setCorrectCount(0);
    setPhase("theory");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onExit}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Bài {lesson.index} / 10</p>
          <h2 className="font-semibold truncate">{lesson.title}</h2>
        </div>
      </div>

      {phase === "theory" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-card card-elevated p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Học xong bài này bạn sẽ
            </p>
            <p className="text-sm">{lesson.goal}</p>
          </div>

          <div className="rounded-xl border border-border/70 bg-card card-elevated p-4 space-y-3">
            {lesson.theory.map((paragraph, i) => (
              <p key={i} className="text-sm leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {lesson.contrast && lesson.contrast.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-card card-elevated overflow-hidden">
              <div className="px-4 py-2 border-b bg-muted/40">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Đối chiếu Việt – Anh
                </p>
              </div>
              <div className="divide-y">
                {lesson.contrast.map((row, i) => (
                  <div key={i} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-muted-foreground">{row.vi}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">{row.en}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{row.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setPhase("quiz")}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
          >
            Hiểu rồi, làm bài tập ({total} câu)
          </button>
        </div>
      )}

      {phase === "quiz" && (
        <div className="space-y-4">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(index / total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Câu {index + 1} / {total} · Đúng {correctCount}
          </p>
          <ExerciseView
            key={`${lesson.id}-${index}`}
            exercise={lesson.exercises[index]}
            onAnswer={handleAnswer}
            onNext={handleNext}
            isLast={index + 1 >= total}
          />
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-card card-elevated p-6 text-center space-y-2">
            <p className="text-4xl font-bold">{scorePercent}%</p>
            <p className="text-sm text-muted-foreground">
              Đúng {correctCount} / {total} câu
            </p>
            <p className="text-sm pt-2">
              {scorePercent >= 80
                ? "Đạt rồi. Bài tiếp theo đã được mở khoá."
                : "Chưa đạt 80%. Đọc lại phần lý thuyết rồi làm lại — không sao cả, khái niệm này cần lặp."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={restart}
              className="flex-1 py-3 rounded-xl border font-medium flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Học lại
            </button>
            <button
              onClick={onExit}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium"
            >
              Về lộ trình
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExerciseView({
  exercise,
  onAnswer,
  onNext,
  isLast,
}: {
  exercise: FoundationExercise;
  onAnswer: (isCorrect: boolean) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Đáp án của người học, tuỳ theo dạng bài.
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [built, setBuilt] = useState<string[]>([]);

  const pool = useMemo(
    () => (exercise.kind === "order" ? shuffle(exercise.tokens) : []),
    [exercise],
  );
  const remaining = useMemo(() => {
    if (exercise.kind !== "order") return [];
    const rest = [...pool];
    for (const token of built) {
      const i = rest.indexOf(token);
      if (i >= 0) rest.splice(i, 1);
    }
    return rest;
  }, [pool, built, exercise]);

  function check() {
    let ok = false;
    if (exercise.kind === "choice") {
      ok = picked === exercise.answerIndex;
    } else if (exercise.kind === "fill") {
      const accepted = [exercise.answer, ...(exercise.accept ?? [])];
      ok = accepted.some((a) => normalize(a) === normalize(typed));
    } else {
      ok = normalize(built.join(" ")) === normalize(exercise.answer);
    }
    setIsCorrect(ok);
    setChecked(true);
    onAnswer(ok);
  }

  const canCheck =
    exercise.kind === "choice"
      ? picked !== null
      : exercise.kind === "fill"
        ? typed.trim().length > 0
        : built.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card card-elevated p-4">
        <p className="text-sm font-medium">{exercise.question}</p>
      </div>

      {exercise.kind === "choice" && (
        <div className="space-y-2">
          {exercise.options.map((option, i) => {
            const selected = picked === i;
            const showRight = checked && i === exercise.answerIndex;
            const showWrong = checked && selected && i !== exercise.answerIndex;
            return (
              <button
                key={i}
                disabled={checked}
                onClick={() => setPicked(i)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                  showRight
                    ? "border-green-500 bg-green-50 dark:bg-green-950/40"
                    : showWrong
                      ? "border-red-500 bg-red-50 dark:bg-red-950/40"
                      : selected
                        ? "border-primary bg-accent"
                        : "hover:bg-accent"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}

      {exercise.kind === "fill" && (
        <input
          value={typed}
          disabled={checked}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canCheck && !checked) check();
          }}
          placeholder="Gõ đáp án…"
          className="w-full px-4 py-3 rounded-xl border bg-background text-sm outline-none focus:border-primary"
        />
      )}

      {exercise.kind === "order" && (
        <div className="space-y-3">
          <div className="min-h-14 rounded-xl border border-dashed p-3 flex flex-wrap gap-2">
            {built.length === 0 && (
              <span className="text-xs text-muted-foreground self-center">
                Bấm các mảnh bên dưới để ghép câu
              </span>
            )}
            {built.map((token, i) => (
              <button
                key={`${token}-${i}`}
                disabled={checked}
                onClick={() => setBuilt((b) => b.filter((_, j) => j !== i))}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm"
              >
                {token}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {remaining.map((token, i) => (
              <button
                key={`${token}-pool-${i}`}
                disabled={checked}
                onClick={() => setBuilt((b) => [...b, token])}
                className="px-3 py-1.5 rounded-lg border text-sm hover:bg-accent"
              >
                {token}
              </button>
            ))}
          </div>
        </div>
      )}

      {checked && (
        <div
          className={`rounded-xl p-4 text-sm space-y-1 ${
            isCorrect
              ? "bg-green-50 dark:bg-green-950/40"
              : "bg-red-50 dark:bg-red-950/40"
          }`}
        >
          <p className="font-medium flex items-center gap-2">
            {isCorrect ? (
              <>
                <Check className="w-4 h-4" /> Đúng rồi
              </>
            ) : (
              <>
                <X className="w-4 h-4" /> Chưa đúng
              </>
            )}
          </p>
          {!isCorrect && exercise.kind !== "choice" && (
            <p>
              Đáp án: <span className="font-medium">{exercise.answer}</span>
            </p>
          )}
          <p className="text-muted-foreground">{exercise.explain}</p>
        </div>
      )}

      {!checked ? (
        <button
          disabled={!canCheck}
          onClick={check}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-40"
        >
          Kiểm tra
        </button>
      ) : (
        <button
          onClick={onNext}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
        >
          {isLast ? "Xem kết quả" : "Câu tiếp theo"}
        </button>
      )}
    </div>
  );
}
