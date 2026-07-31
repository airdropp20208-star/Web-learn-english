"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Flame,
  Coins,
  TrendingUp,
  Trophy,
  Calendar,
  BookOpen,
  Brain,
  Gamepad2,
} from "lucide-react";
import {
  getState,
  getLevelProgress,
  ACHIEVEMENTS,
  type GamificationState,
} from "@/lib/gamification";
import { getVocabItems, getMemoryItems, getTexts } from "@/lib/storage";

interface ProfileTabProps {
  userId: string;
}

export function ProfileTab({ userId }: ProfileTabProps) {
  const [loading, setLoading] = useState(true);
  // null cho tới khi đọc xong localStorage — tránh lệch giữa server và client
  const [state, setState] = useState<GamificationState | null>(null);
  const [vocabCount, setVocabCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [textCount, setTextCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [v, m, t] = await Promise.all([
        getVocabItems(userId),
        getMemoryItems(userId),
        getTexts(userId),
      ]);
      if (cancelled) return;
      setState(getState());
      setVocabCount(v.length);
      setReviewCount(m.filter((x) => x.card.reps > 0).length);
      setTextCount(t.length);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading || !state) {
    return <Skeleton className="h-96 w-full" />;
  }

  const levelProgress = getLevelProgress(state);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center text-2xl font-bold">
            L{state.level}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">Local User</h2>
            <p className="text-primary-foreground/80 text-sm">
              Level {state.level} · {state.xp.toLocaleString()} XP
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-primary-foreground/80 mb-1">
            <span>Level {state.level}</span>
            <span>
              {levelProgress.earned}/{levelProgress.needed} XP · Level{" "}
              {state.level + 1}
            </span>
          </div>
          <div className="h-2 bg-primary-foreground/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-foreground transition-all"
              style={{ width: `${levelProgress.percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox
          icon={<Coins className="w-5 h-5 text-amber-500" />}
          value={state.coins.toLocaleString()}
          label="Coins"
        />
        <StatBox
          icon={<Flame className="w-5 h-5 text-orange-500" />}
          value={`${state.streak}`}
          label="Streak"
        />
        <StatBox
          icon={<BookOpen className="w-5 h-5 text-blue-500" />}
          value={`${vocabCount}`}
          label="Từ vựng"
        />
        <StatBox
          icon={<Brain className="w-5 h-5 text-purple-500" />}
          value={`${reviewCount}`}
          label="Đã ôn"
        />
      </div>

      {/* Today's progress */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Hôm nay</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold">{state.todayProgress.wordsLearned}</div>
            <div className="text-xs text-muted-foreground">Từ học</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{state.todayProgress.wordsReviewed}</div>
            <div className="text-xs text-muted-foreground">Từ ôn</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{state.todayProgress.gamesPlayed}</div>
            <div className="text-xs text-muted-foreground">Game</div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold">Thành tích</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            {state.achievements.length}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = state.achievements.includes(ach.id);
            return (
              <div
                key={ach.id}
                className={`p-3 rounded-lg border text-center transition-all ${
                  unlocked
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                    : "bg-muted/30 border-border opacity-60"
                }`}
              >
                <div className={`text-2xl mb-1 ${unlocked ? "" : "grayscale"}`}>
                  {unlocked ? ach.icon : "🔒"}
                </div>
                <div className="text-xs font-medium">{ach.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {ach.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatBox({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="bg-card rounded-xl border p-4 flex flex-col items-center gap-1">
      <div className="mb-1">{icon}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
