"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Home,
  Compass,
  Layers,
  BookOpen,
  Library,
  Gamepad2,
  User,
  Coins,
  Flame,
  Sparkles,
} from "lucide-react";
import { HomeTab } from "@/components/tabs/home-tab";
import { PathTab } from "@/components/tabs/path-tab";
import { DecksTab } from "@/components/tabs/decks-tab";
import { StudyTab } from "@/components/tabs/study-tab";
import { LibraryTab } from "@/components/tabs/library-tab";
import { GamesTab } from "@/components/tabs/games-tab";
import { ProfileTab } from "@/components/tabs/profile-tab";
import { LandingPage } from "@/components/landing-page";
import { DEFAULT_USER_ID } from "@/lib/auth";
import { getState, type GamificationState } from "@/lib/gamification";

type TabId =
  | "home"
  | "path"
  | "decks"
  | "study"
  | "library"
  | "games"
  | "profile";

type StudyModeId = "flashcard" | "review" | "quiz" | "read";

interface TabDef {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: "home", label: "Trang chủ", shortLabel: "Nhà", icon: Home },
  { id: "path", label: "Lộ trình", shortLabel: "Lộ trình", icon: Compass },
  { id: "decks", label: "Bộ từ", shortLabel: "Bộ từ", icon: Layers },
  { id: "study", label: "Học", shortLabel: "Học", icon: BookOpen },
  { id: "library", label: "Thư viện", shortLabel: "Đọc", icon: Library },
  { id: "games", label: "Game", shortLabel: "Game", icon: Gamepad2 },
  { id: "profile", label: "Hồ sơ", shortLabel: "Tôi", icon: User },
];

const userId = DEFAULT_USER_ID;

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PageContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 rounded-2xl bg-brand animate-pulse" />
    </div>
  );
}

function PageContent() {
  const searchParams = useSearchParams();
  const [showLanding, setShowLanding] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [studyMode, setStudyMode] = useState<StudyModeId>("flashcard");
  const [initialDeckId, setInitialDeckId] = useState<string | undefined>(
    undefined
  );
  // null cho tới khi đọc xong localStorage — tránh lệch nội dung khi hydrate
  const [gamificationState, setGamificationState] =
    useState<GamificationState | null>(null);

  useEffect(() => {
    if (searchParams.get("app") === "1") {
      setShowLanding(false);
    }
  }, [searchParams]);

  useEffect(() => {
    const update = () => setGamificationState(getState());
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);

  function handleNavigate(tab: string, deckId?: string) {
    if (tab.startsWith("study:")) {
      setStudyMode(tab.slice(6) as StudyModeId);
      setActiveTab("study");
    } else {
      setActiveTab(tab as TabId);
    }
    if (deckId) setInitialDeckId(deckId);
    setShowLanding(false);
  }

  function handleStudyNavigate(mode: StudyModeId) {
    setStudyMode(mode);
    setActiveTab("study");
    setShowLanding(false);
  }

  if (showLanding) {
    return <LandingPage onStart={() => setShowLanding(false)} />;
  }

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? "";

  return (
    <div className="min-h-screen bg-background">
      {/* Thanh bên (desktop) */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 border-r bg-sidebar flex-col p-4 z-30">
        <button
          onClick={() => setShowLanding(true)}
          className="flex items-center gap-2.5 mb-6 px-1"
        >
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white font-bold">
            L
          </div>
          <div className="text-left leading-tight">
            <div className="font-semibold text-sm">Learn English</div>
            <div className="text-[11px] text-muted-foreground">
              Học có lộ trình
            </div>
          </div>
        </button>

        <nav className="flex flex-col gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  isActive
                    ? "bg-brand text-white shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Thẻ streak dưới cùng thanh bên */}
        <div className="mt-auto rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold">
              {gamificationState?.streak ?? 0} ngày liên tiếp
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Học mỗi ngày một chút để không đứt chuỗi.
          </p>
        </div>
      </aside>

      {/* Vùng nội dung — chừa lề trái đúng bằng thanh bên.
          Bản cũ thiếu lề này nên nội dung bị nằm đè dưới thanh bên. */}
      <div className="md:pl-60 flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setShowLanding(true)}
                className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center text-white font-bold text-sm shrink-0 md:hidden"
              >
                L
              </button>
              <h1 className="font-semibold truncate">{activeLabel}</h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Pill
                icon={<Sparkles className="w-3.5 h-3.5" />}
                value={`Lv ${gamificationState?.level ?? 1}`}
                className="bg-primary/10 text-primary"
              />
              <Pill
                icon={<Coins className="w-3.5 h-3.5" />}
                value={gamificationState?.coins ?? 0}
                className="bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
              />
              <Pill
                icon={<Flame className="w-3.5 h-3.5" />}
                value={gamificationState?.streak ?? 0}
                className="bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400"
              />
            </div>
          </div>
        </header>

        <main
          key={activeTab}
          className="flex-1 w-full max-w-4xl mx-auto px-4 py-5 pb-28 md:pb-8 animate-rise"
        >
          {activeTab === "home" && (
            <HomeTab onNavigate={(t) => handleNavigate(t)} />
          )}
          {activeTab === "path" && <PathTab />}
          {activeTab === "decks" && (
            <DecksTab
              userId={userId}
              onNavigate={(t, did) => handleNavigate(t, did)}
            />
          )}
          {activeTab === "study" && (
            <StudyTab
              userId={userId}
              initialMode={studyMode}
              initialDeckId={initialDeckId}
              onNavigate={handleStudyNavigate}
            />
          )}
          {activeTab === "library" && <LibraryTab userId={userId} />}
          {activeTab === "games" && <GamesTab userId={userId} />}
          {activeTab === "profile" && <ProfileTab userId={userId} />}
        </main>
      </div>

      {/* Thanh điều hướng dưới (điện thoại) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/90 backdrop-blur-xl md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-7">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex flex-col items-center gap-1 py-2"
              >
                {/* Vạch chỉ báo tab đang chọn */}
                <span
                  className={`absolute top-0 h-0.5 w-8 rounded-full transition-opacity ${
                    isActive ? "bg-brand opacity-100" : "opacity-0"
                  }`}
                />
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Pill({
  icon,
  value,
  className,
}: {
  icon: React.ReactNode;
  value: string | number;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}
    >
      {icon}
      {value}
    </span>
  );
}
