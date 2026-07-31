"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Flame,
  Coins,
  TrendingUp,
  Target,
  ArrowRight,
  BookOpen,
  Brain,
  Gamepad2,
  Library,
  Layers,
  Zap,
} from "lucide-react";
import {
  getState,
  getDailyProgress,
  DAILY_GOAL,
  award,
} from "@/lib/gamification";
import { getNoActivityComment, getDailyGoalDoneComment } from "@/lib/humor";

interface HomeTabProps {
  onNavigate: (tab: string) => void;
}

export function HomeTab({ onNavigate }: HomeTabProps) {
  const [state, setState] = useState(() => getState());
  const [dailyProgress, setDailyProgress] = useState(() => getDailyProgress());

  useEffect(() => {
    // Daily login bonus on mount
    const today = new Date().toISOString().split("T")[0];
    if (state.lastStudyDate !== today) {
      const { newAchievements } = award("daily-login");
      setTimeout(() => {
        setState(getState());
        setDailyProgress(getDailyProgress());
        newAchievements.forEach((a) => {
          toast.success(`🏅 ${a.name}: ${a.description}`);
        });
      }, 0);
    }
  }, []);

  const xpForNextLevel = (state.level + 1) * (state.level + 1) * 100;
  const xpForCurrentLevel = state.level * state.level * 100;
  const xpProgress = ((state.xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;
  const goalDone = dailyProgress.current >= DAILY_GOAL;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold">
          {greeting()} 👋
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {goalDone
            ? getDailyGoalDoneComment()
            : dailyProgress.current === 0
            ? getNoActivityComment(DAILY_GOAL)
            : `Còn ${DAILY_GOAL - dailyProgress.current} từ nữa là đạt mục tiêu hôm nay`}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Coins className="w-5 h-5 text-amber-500" />}
          value={state.coins.toLocaleString()}
          label="Coins"
        />
        <StatCard
          icon={<Flame className="w-5 h-5 text-orange-500" />}
          value={`${state.streak}`}
          label="Streak (ngày)"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          value={`${state.level}`}
          label="Level"
        />
      </div>

      {/* Daily goal + Level progress */}
      <div className="bg-card rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Mục tiêu hôm nay</h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {dailyProgress.current}/{DAILY_GOAL} từ
          </span>
        </div>
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${goalDone ? "bg-emerald-500" : "bg-primary"}`}
            style={{ width: `${dailyProgress.percent}%` }}
          />
        </div>
        {goalDone && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            ✅ Đã hoàn thành! Bạn có thể học thêm hoặc nghỉ ngơi.
          </p>
        )}

        {/* Level progress */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Level {state.level}</span>
            <span className="text-xs text-muted-foreground">
              {state.xp - xpForCurrentLevel}/{xpForNextLevel - xpForCurrentLevel} XP
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, xpProgress))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="font-semibold mb-3">Bắt đầu học</h3>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            icon={<Layers className="w-5 h-5" />}
            title="Bộ từ"
            desc="Chọn deck để học"
            onClick={() => onNavigate("decks")}
          />
          <QuickAction
            icon={<BookOpen className="w-5 h-5" />}
            title="Flashcard"
            desc="Học từ mới"
            onClick={() => onNavigate("study")}
          />
          <QuickAction
            icon={<Brain className="w-5 h-5" />}
            title="Ôn tập"
            desc="FSRS review"
            onClick={() => onNavigate("study")}
          />
          <QuickAction
            icon={<Gamepad2 className="w-5 h-5" />}
            title="Mini-games"
            desc="Match + Spelling"
            onClick={() => onNavigate("games")}
          />
          <QuickAction
            icon={<Library className="w-5 h-5" />}
            title="Thư viện"
            desc="30 bài đọc A1-C2"
            onClick={() => onNavigate("library")}
          />
          <QuickAction
            icon={<Zap className="w-5 h-5" />}
            title="Đọc văn bản"
            desc="Paste text + analyze"
            onClick={() => onNavigate("study")}
          />
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function StatCard({
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
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-card rounded-xl border p-4 text-left hover:shadow-md hover:border-primary/30 transition-all group"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
      </div>
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}
