"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Volume2, Check } from "lucide-react";
import { STARTER_GROUPS, type StarterWord } from "@/lib/starter-vocab";
import { getPathProgress, toggleLearnedWord } from "@/lib/path-progress";

interface Props {
  onExit: () => void;
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function StarterVocabPlayer({ onExit }: Props) {
  const [groupId, setGroupId] = useState(STARTER_GROUPS[0].id);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [learned, setLearned] = useState<string[]>(
    () => getPathProgress().learnedWords,
  );

  const group = useMemo(
    () => STARTER_GROUPS.find((g) => g.id === groupId) ?? STARTER_GROUPS[0],
    [groupId],
  );
  const word: StarterWord = group.words[Math.min(index, group.words.length - 1)];
  const isLearned = learned.includes(word.en);

  function pickGroup(id: string) {
    setGroupId(id);
    setIndex(0);
    setRevealed(false);
  }

  function next() {
    setRevealed(false);
    setIndex((i) => (i + 1) % group.words.length);
  }

  function markLearned() {
    const updated = toggleLearnedWord(word.en);
    setLearned(updated.learnedWords);
    next();
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
        <div>
          <p className="text-xs text-muted-foreground">Chặng 0 · 100 từ nền tảng</p>
          <h2 className="font-semibold">{group.label}</h2>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STARTER_GROUPS.map((g) => (
          <button
            key={g.id}
            onClick={() => pickGroup(g.id)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              g.id === groupId
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-accent"
            }`}
          >
            {g.label.split(" — ")[0]} ({g.words.length})
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card card-elevated p-6 space-y-4 text-center">
        <p className="text-xs text-muted-foreground">
          Từ {index + 1} / {group.words.length}
        </p>

        <div className="space-y-1">
          <p className="text-3xl font-bold">{word.en}</p>
          <p className="text-sm text-muted-foreground">{word.ipa}</p>
        </div>

        <button
          onClick={() => speak(word.en)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm hover:bg-accent"
        >
          <Volume2 className="w-4 h-4" />
          Nghe phát âm
        </button>

        {revealed ? (
          <div className="space-y-3 pt-2">
            <p className="text-xl font-medium">{word.vi}</p>
            <div className="rounded-xl bg-muted/50 p-3 space-y-1">
              <button
                onClick={() => speak(word.example)}
                className="text-sm font-medium hover:underline"
              >
                {word.example}
              </button>
              <p className="text-sm text-muted-foreground">{word.exampleVi}</p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="w-full py-3 rounded-xl border font-medium"
          >
            Hiện nghĩa và câu ví dụ
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={next} className="flex-1 py-3 rounded-xl border font-medium">
          Chưa thuộc
        </button>
        <button
          onClick={markLearned}
          className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 ${
            isLearned
              ? "border"
              : "bg-primary text-primary-foreground"
          }`}
        >
          <Check className="w-4 h-4" />
          {isLearned ? "Bỏ đánh dấu" : "Đã thuộc"}
        </button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Đã thuộc {learned.length} / 100 từ nền tảng
      </p>
    </div>
  );
}
