"use client";

import { useEffect, useState } from "react";
import { Lock, Check, Play, Sparkles, RotateCcw } from "lucide-react";
import { FOUNDATION_LESSONS } from "@/lib/foundation-lessons";
import { STARTER_WORD_COUNT, SURVIVAL_PATTERNS } from "@/lib/starter-vocab";
import {
  foundationPercent,
  getPathProgress,
  isLessonUnlocked,
  isStarterVocabUnlocked,
  nextLessonId,
  recordLessonResult,
  resetPathProgress,
  type PathProgress,
} from "@/lib/path-progress";
import { FoundationLessonPlayer } from "@/components/foundation-lesson-player";
import { StarterVocabPlayer } from "@/components/starter-vocab-player";

type View = { mode: "list" } | { mode: "lesson"; id: string } | { mode: "starter" };

export function PathTab() {
  const [view, setView] = useState<View>({ mode: "list" });
  // null cho tới khi đọc xong localStorage — tránh lệch giữa server và client.
  const [progress, setProgress] = useState<PathProgress | null>(null);

  useEffect(() => {
    setProgress(getPathProgress());
  }, []);

  if (!progress) {
    return <div className="h-40 rounded-xl bg-muted animate-pulse" />;
  }

  if (view.mode === "lesson") {
    const lesson = FOUNDATION_LESSONS.find((l) => l.id === view.id);
    if (!lesson) {
      setView({ mode: "list" });
      return null;
    }
    return (
      <FoundationLessonPlayer
        lesson={lesson}
        onExit={() => {
          setProgress(getPathProgress());
          setView({ mode: "list" });
        }}
        onFinish={(score) => setProgress(recordLessonResult(lesson.id, score))}
      />
    );
  }

  if (view.mode === "starter") {
    return (
      <StarterVocabPlayer
        onExit={() => {
          setProgress(getPathProgress());
          setView({ mode: "list" });
        }}
      />
    );
  }

  const percent = foundationPercent(progress);
  const nextId = nextLessonId(progress);
  const starterUnlocked = isStarterVocabUnlocked(progress);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Lộ trình học từ số 0</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Chưa biết \"động từ\" hay \"thì\" là gì cũng bắt đầu được. Học theo thứ
              tự, mỗi bài 10 phút.
            </p>
          </div>
          <button
            onClick={() => {
              if (window.confirm("Xoá toàn bộ tiến độ lộ trình?")) {
                setProgress(resetPathProgress());
              }
            }}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground shrink-0"
            aria-label="Đặt lại tiến độ"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Chặng −1 · Vỡ lòng</span>
            <span>
              {progress.completedLessons.length} / {FOUNDATION_LESSONS.length} bài
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {nextId && (
          <button
            onClick={() => setView({ mode: "lesson", id: nextId })}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Học tiếp bài{" "}
            {FOUNDATION_LESSONS.find((l) => l.id === nextId)?.index}
          </button>
        )}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Chặng −1 — Vỡ lòng: logic tiếng Anh</h2>
          <p className="text-sm text-muted-foreground">
            10 bài dạy khái niệm bằng tiếng Việt. Phải đạt 80% mới mở bài sau.
          </p>
        </div>

        <div className="space-y-2">
          {FOUNDATION_LESSONS.map((lesson) => {
            const done = progress.completedLessons.includes(lesson.id);
            const unlocked = isLessonUnlocked(lesson.id, progress);
            const score = progress.lessonScores[lesson.id];
            return (
              <button
                key={lesson.id}
                disabled={!unlocked}
                onClick={() => setView({ mode: "lesson", id: lesson.id })}
                className={`w-full text-left rounded-xl border p-4 flex items-center gap-3 transition-colors ${
                  unlocked ? "hover:bg-accent" : "opacity-50 cursor-not-allowed"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold ${
                    done
                      ? "bg-green-500 text-white"
                      : unlocked
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="w-4 h-4" />
                  ) : unlocked ? (
                    lesson.index
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{lesson.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {lesson.goal}
                  </p>
                </div>
                {typeof score === "number" && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {score}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Chặng 0 — {STARTER_WORD_COUNT} từ nền tảng</h2>
          <p className="text-sm text-muted-foreground">
            Nhóm từ xuất hiện nhiều nhất trong giao tiếp hằng ngày. Mỗi từ có phiên
            âm, nghĩa Việt và một câu ví dụ.
          </p>
        </div>

        <button
          disabled={!starterUnlocked}
          onClick={() => setView({ mode: "starter" })}
          className={`w-full rounded-xl border p-4 flex items-center gap-3 text-left transition-colors ${
            starterUnlocked ? "hover:bg-accent" : "opacity-50 cursor-not-allowed"
          }`}
        >
          <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center bg-amber-500 text-white">
            {starterUnlocked ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Học {STARTER_WORD_COUNT} từ nền tảng</p>
            <p className="text-xs text-muted-foreground">
              {starterUnlocked
                ? `Đã thuộc ${progress.learnedWords.length} / ${STARTER_WORD_COUNT} từ`
                : "Hoàn thành 10 bài vỡ lòng để mở khoá"}
            </p>
          </div>
        </button>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">10 mẫu câu sinh tồn</h2>
          <p className="text-sm text-muted-foreground">
            Ghép được 10 mẫu này với 100 từ ở trên là bạn nói được việc cơ bản.
          </p>
        </div>
        <div className="rounded-xl border bg-card divide-y">
          {SURVIVAL_PATTERNS.map((pattern) => (
            <div key={pattern.en} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium">{pattern.en}</span>
                <span className="text-sm text-muted-foreground">{pattern.vi}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{pattern.note}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
