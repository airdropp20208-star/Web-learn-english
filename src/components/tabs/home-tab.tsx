"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Flame,
  Coins,
  TrendingUp,
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
  getLevelProgress,
  DAILY_GOAL,
  award,
} from "@/lib/gamification";
import {
  useGamification,
  useGamificationReady,
  useDailyProgress,
} from "@/hooks/use-gamification";
import { getNoActivityComment, getDailyGoalDoneComment } from "@/lib/humor";

interface HomeTabProps {
  onNavigate: (tab: string) => void;
}

export function HomeTab({ onNavigate }: HomeTabProps) {
  const state = useGamification();
  const dailyProgress = useDailyProgress();
  const ready = useGamificationReady();

  // Điểm danh hằng ngày là tác dụng phụ thật (ghi localStorage + hiện huy
  // hiệu), nên vẫn thuộc về effect — nhưng không còn setState đồng bộ ở đây:
  // award() tự báo cho store và mọi nơi đang xem sẽ vẽ lại.
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    if (getState().lastStudyDate === today) return;
    const { newAchievements } = award("daily-login");
    newAchievements.forEach((a) => {
      toast.success(`🏅 ${a.name}: ${a.description}`);
    });
  }, []);

  if (!ready) {
    return (
      <div className="space-y-5">
        <div className="h-44 rounded-2xl bg-muted animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-24 rounded-2xl bg-muted animate-pulse" />
          <div className="h-24 rounded-2xl bg-muted animate-pulse" />
          <div className="h-24 rounded-2xl bg-muted animate-pulse" />
        </div>
        <div className="h-40 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  const levelProgress = getLevelProgress(state);
  const goalDone = dailyProgress.current >= DAILY_GOAL;

  return (
    <div className="space-y-5">
      {/* Hero: lời chào + vòng tròn tiến độ hôm nay */}
      <section className="relative overflow-hidden rounded-2xl bg-brand text-white p-6 card-elevated">
        {/* Hai khối sáng mờ tạo chiều sâu cho nền gradient */}
        <div className="absolute -top-16 -right-10 w-52 h-52 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -left-10 w-52 h-52 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center gap-5">
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-sm">{greeting()} 👋</p>
            <h2 className="text-xl font-bold mt-0.5 leading-snug">
              {goalDone
                ? "Xong mục tiêu hôm nay rồi"
                : `Còn ${DAILY_GOAL - dailyProgress.current} từ nữa là đạt mục tiêu`}
            </h2>
            <p className="text-white/80 text-sm mt-2 line-clamp-2">
              {goalDone
                ? getDailyGoalDoneComment()
                : dailyProgress.current === 0
                  ? getNoActivityComment(DAILY_GOAL)
                  : "Giữ nhịp đi, sắp tới đích rồi."}
            </p>

            <button
              onClick={() => onNavigate("study:flashcard")}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-primary font-semibold text-sm hover:bg-white/90 transition-colors"
            >
              {dailyProgress.current === 0 ? "Bắt đầu học" : "Học tiếp"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <ProgressRing
            percent={dailyProgress.percent}
            current={dailyProgress.current}
            goal={DAILY_GOAL}
          />
        </div>
      </section>

      {/* Thống kê nhanh */}
      <section className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Coins className="w-4 h-4" />}
          tone="bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
          value={state.coins.toLocaleString()}
          label="Coins"
        />
        <StatCard
          icon={<Flame className="w-4 h-4" />}
          tone="bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400"
          value={`${state.streak}`}
          label="Ngày liên tiếp"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
          value={`${state.level}`}
          label="Cấp độ"
        />
      </section>

      {/* Tiến độ lên cấp */}
      <section className="rounded-2xl border border-border/70 bg-card card-elevated p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-semibold">Cấp {state.level}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {levelProgress.earned}/{levelProgress.needed} XP
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden ring-1 ring-inset ring-border/50">
          <div
            className="h-full bg-brand rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_-2px_oklch(0.55_0.21_278/60%)]"
            style={{ width: `${levelProgress.percent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Còn {Math.max(0, levelProgress.needed - levelProgress.earned)} XP nữa là
          lên cấp {state.level + 1}.
        </p>
      </section>

      {/* Lối tắt */}
      <section>
        <h3 className="font-semibold mb-3">Bắt đầu học</h3>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            icon={<Layers className="w-5 h-5" />}
            tone="bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400"
            title="Bộ từ"
            desc="Chọn bộ để học"
            onClick={() => onNavigate("decks")}
          />
          <QuickAction
            icon={<BookOpen className="w-5 h-5" />}
            tone="bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400"
            title="Flashcard"
            desc="Học từ mới"
            onClick={() => onNavigate("study:flashcard")}
          />
          <QuickAction
            icon={<Brain className="w-5 h-5" />}
            tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
            title="Ôn tập"
            desc="Từ đến hạn nhắc lại"
            onClick={() => onNavigate("study:review")}
          />
          <QuickAction
            icon={<Gamepad2 className="w-5 h-5" />}
            tone="bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
            title="Game"
            desc="Đấu trùm, nối từ"
            onClick={() => onNavigate("games")}
          />
          <QuickAction
            icon={<Library className="w-5 h-5" />}
            tone="bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
            title="Thư viện"
            desc="Bài đọc theo trình độ"
            onClick={() => onNavigate("library")}
          />
          <QuickAction
            icon={<Zap className="w-5 h-5" />}
            tone="bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-950/60 dark:text-fuchsia-400"
            title="Đọc văn bản"
            desc="Dán đoạn văn để phân tích"
            onClick={() => onNavigate("study:read")}
          />
        </div>
      </section>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/** Vòng tròn tiến độ vẽ bằng SVG, không cần thư viện ngoài. */
function ProgressRing({
  percent,
  current,
  goal,
}: {
  percent: number;
  current: number;
  goal: number;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative w-24 h-24 shrink-0 hidden sm:block">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-white/25"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-white transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none">{current}</span>
        <span className="text-[11px] text-white/70 mt-0.5">/ {goal} từ</span>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  tone,
  value,
  label,
}: {
  icon: React.ReactNode;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card card-elevated p-4 flex flex-col items-center gap-1.5">
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}
      >
        {icon}
      </div>
      <div className="text-xl font-bold leading-none">{value}</div>
      <div className="text-[11px] text-muted-foreground text-center">{label}</div>
    </div>
  );
}

function QuickAction({
  icon,
  tone,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-border/70 bg-card card-elevated p-4 text-left card-hover press hover:border-primary/40"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}
        >
          {icon}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
      </div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </button>
  );
}
