"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Brain,
  Headphones,
  ListChecks,
  TrendingUp,
  NotebookPen,
} from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { ReadTab } from "@/components/tabs/read-tab";
import { QuizTab } from "@/components/tabs/quiz-tab";
import { ReviewTab } from "@/components/tabs/review-tab";
import { VocabTab } from "@/components/tabs/vocab-tab";
import { ProgressTab } from "@/components/tabs/progress-tab";
import { ShadowTab } from "@/components/tabs/shadow-tab";
import { DEFAULT_USER_ID } from "@/lib/auth";

type TabId = "read" | "quiz" | "review" | "vocab" | "progress" | "shadow";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: TabDef[] = [
  { id: "read", label: "Read", icon: BookOpen, description: "Paste a text and learn vocabulary in context" },
  { id: "quiz", label: "Quiz", icon: ListChecks, description: "Test your comprehension with mixed-format questions" },
  { id: "review", label: "Review", icon: Brain, description: "Spaced repetition session based on your memory" },
  { id: "vocab", label: "Vocab", icon: NotebookPen, description: "Your saved words and their memory strength" },
  { id: "progress", label: "Progress", icon: TrendingUp, description: "Current tier and mastery level" },
  { id: "shadow", label: "Shadow", icon: Headphones, description: "Listen and shadow the audio of texts you read" },
];

const userId = DEFAULT_USER_ID;

export default function Home() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <HomeContent />
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

function HomeContent() {
  const searchParams = useSearchParams();

  const initialTab = (() => {
    const tab = searchParams.get("tab") as TabId | null;
    return tab && TABS.some((t) => t.id === tab) ? tab : "read";
  })();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const active = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">
              L
            </div>
            <h1 className="text-lg font-semibold">Learn English</h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Reading · Quiz · Shadowing
            </span>
          </div>
          <div className="flex items-center gap-3">
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        <aside className="hidden md:flex w-56 border-r bg-card flex-col p-3 gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left ${
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

        <div className="md:hidden border-b bg-card overflow-x-auto">
          <div className="flex gap-1 px-2 py-2 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <main className="flex-1 min-w-0 p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <active.icon className="w-5 h-5" />
              {active.label}
            </h2>
            <p className="text-sm text-muted-foreground">{active.description}</p>
          </div>

          {activeTab === "read" && <ReadTab userId={userId} />}
          {activeTab === "quiz" && <QuizTab userId={userId} />}
          {activeTab === "review" && <ReviewTab userId={userId} />}
          {activeTab === "vocab" && <VocabTab userId={userId} />}
          {activeTab === "progress" && <ProgressTab userId={userId} />}
          {activeTab === "shadow" && <ShadowTab userId={userId} />}
        </main>
      </div>

      <footer className="border-t bg-card mt-auto">
        <div className="px-4 py-3 text-xs text-muted-foreground text-center max-w-7xl mx-auto">
          Learn English · MVP · Reading + Quiz + Mastery + Shadowing
        </div>
      </footer>
    </div>
  );
}
