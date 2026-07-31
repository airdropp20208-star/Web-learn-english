"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Home,
  Layers,
  BookOpen,
  Library,
  Gamepad2,
  User,
  Coins,
  Flame,
} from "lucide-react";
import { HomeTab } from "@/components/tabs/home-tab";
import { DecksTab } from "@/components/tabs/decks-tab";
import { StudyTab } from "@/components/tabs/study-tab";
import { LibraryTab } from "@/components/tabs/library-tab";
import { GamesTab } from "@/components/tabs/games-tab";
import { ProfileTab } from "@/components/tabs/profile-tab";
import { LandingPage } from "@/components/landing-page";
import { DEFAULT_USER_ID } from "@/lib/auth";
import { getState, type GamificationState } from "@/lib/gamification";

type TabId = "home" | "decks" | "study" | "library" | "games" | "profile";

type StudyModeId = "flashcard" | "review" | "quiz" | "read";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: "home", label: "Trang chủ", icon: Home },
  { id: "decks", label: "Bộ từ", icon: Layers },
  { id: "study", label: "Học", icon: BookOpen },
  { id: "library", label: "Thư viện", icon: Library },
  { id: "games", label: "Game", icon: Gamepad2 },
  { id: "profile", label: "Hồ sơ", icon: User },
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
    <div className="min-h-screen flex items-center justify-center">
      <Skeleton className="h-8 w-32" />
    </div>
  );
}

function PageContent() {
  const searchParams = useSearchParams();
  const [showLanding, setShowLanding] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [studyMode, setStudyMode] = useState<StudyModeId>("flashcard");
  const [initialDeckId, setInitialDeckId] = useState<string | undefined>(undefined);
  // null until hydrated from localStorage (client-only) — avoids SSR mismatch
  const [gamificationState, setGamificationState] = useState<GamificationState | null>(null);

  // Deep link: ?app=1 skips the landing page.
  // setState runs inside an effect, never during render.
  useEffect(() => {
    if (searchParams.get("app") === "1") {
      setShowLanding(false);
    }
  }, [searchParams]);

  // Hydrate gamification state after mount, then refresh every 5s
  // (for live coin/streak updates)
  useEffect(() => {
    const update = () => setGamificationState(getState());
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);

  function handleNavigate(tab: string, deckId?: string) {
    // Support deep links into Study sub-modes:
    // "study:flashcard" | "study:review" | "study:quiz" | "study:read"
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top header — gamification stats */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setShowLanding(true)}
            className="flex items-center gap-2 hover:opacity-80"
          >
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              L
            </div>
            <span className="font-semibold hidden sm:inline">Learn English</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/50">
              <Coins className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {gamificationState?.coins ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/50">
              <Flame className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                {gamificationState?.streak ?? 0}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5 pb-24 md:pb-5">
        {activeTab === "home" && <HomeTab onNavigate={(t) => handleNavigate(t)} />}
        {activeTab === "decks" && (
          <DecksTab userId={userId} onNavigate={(t, did) => handleNavigate(t, did)} />
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

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-6 max-w-5xl mx-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-56 border-r bg-card flex-col p-3 pt-20 z-30">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left mb-1 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </aside>
    </div>
  );
}
