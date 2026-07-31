"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Brain,
  ListChecks,
  FileText,
} from "lucide-react";
import { FlashcardTab } from "@/components/tabs/flashcard-tab";
import { ReviewTab } from "@/components/tabs/review-tab";
import { QuizTab } from "@/components/tabs/quiz-tab";
import { ReadTab } from "@/components/tabs/read-tab";

interface StudyTabProps {
  userId: string;
  initialMode?: "flashcard" | "review" | "quiz" | "read";
  initialDeckId?: string;
  onNavigate: (mode: "flashcard" | "review" | "quiz" | "read") => void;
}

type StudyMode = "flashcard" | "review" | "quiz" | "read";

const MODES: Array<{
  id: StudyMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}> = [
  { id: "flashcard", label: "Flashcard", icon: BookOpen, desc: "Học từ mới" },
  { id: "review", label: "Ôn tập", icon: Brain, desc: "FSRS spaced repetition" },
  { id: "quiz", label: "Quiz", icon: ListChecks, desc: "Trắc nghiệm + cloze" },
  { id: "read", label: "Đọc", icon: FileText, desc: "Paste text + analyze" },
];

export function StudyTab({
  userId,
  initialMode = "flashcard",
  initialDeckId,
  onNavigate,
}: StudyTabProps) {
  const [mode, setMode] = useState<StudyMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg overflow-x-auto">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                onNavigate(m.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Mode content */}
      {mode === "flashcard" && <FlashcardTab userId={userId} initialDeckId={initialDeckId} />}
      {mode === "review" && <ReviewTab userId={userId} />}
      {mode === "quiz" && <QuizTab userId={userId} />}
      {mode === "read" && <ReadTab userId={userId} />}
    </div>
  );
}
