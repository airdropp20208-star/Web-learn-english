"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookOpen, Brain, Headphones, ListChecks, TrendingUp, NotebookPen, LogOut } from "lucide-react";
import { ReadTab } from "@/components/tabs/read-tab";
import { QuizTab } from "@/components/tabs/quiz-tab";
import { ReviewTab } from "@/components/tabs/review-tab";
import { VocabTab } from "@/components/tabs/vocab-tab";
import { ProgressTab } from "@/components/tabs/progress-tab";
import { ShadowTab } from "@/components/tabs/shadow-tab";

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

export default function Home() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<TabId>("read");

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  const userId = (session.user as { id?: string })?.id;
  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Session error</CardTitle>
            <CardDescription>User ID missing from session. Please sign out and try again.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => signOut()} variant="outline">
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const active = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
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
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {session.user?.name ?? session.user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="w-4 h-4 mr-1" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Sidebar — desktop */}
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

        {/* Mobile tab bar */}
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

        {/* Main content */}
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

      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="px-4 py-3 text-xs text-muted-foreground text-center max-w-7xl mx-auto">
          Learn English · MVP · Reading + Quiz + Mastery + Shadowing
        </div>
      </footer>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      name: name || undefined,
      redirect: false,
    });
    setLoading(false);
    if (!res?.ok) {
      setError(res?.error ?? "Sign-in failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
              L
            </div>
            <div>
              <CardTitle>Learn English</CardTitle>
              <CardDescription>Reading · Quiz · Shadowing</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Display name (optional)</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in / Sign up"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Demo mode — no real auth. GitHub OAuth ready (set env vars).
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
