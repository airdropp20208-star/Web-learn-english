"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Brain,
  Headphones,
  ListChecks,
  TrendingUp,
  NotebookPen,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { UserMenu } from "@/components/user-menu";
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
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  const initialTab = (() => {
    const tab = searchParams.get("tab") as TabId | null;
    return tab && TABS.some((t) => t.id === tab) ? tab : "read";
  })();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const authError = (() => {
    const error = searchParams.get("error");
    if (!error) return null;
    const errorMessages: Record<string, string> = {
      CredentialsSignin: "Invalid username or password.",
      Configuration: "NextAuth configuration error. Ensure NEXTAUTH_SECRET is set.",
      default: "Sign-in failed. Please try again.",
    };
    return errorMessages[error] ?? errorMessages.default;
  })();

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (!session) {
    return <LoginForm authError={authError} initialMode="login" />;
  }

  const userId = (session.user as { id?: string })?.id;
  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Session error</CardTitle>
            <CardDescription>
              User ID missing from session. Sign out and try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => signIn("credentials", { callbackUrl: "/" })} variant="outline">
              Re-sign-in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const active = TABS.find((t) => t.id === activeTab)!;

  function handleSignedOutClick(targetTab?: string) {
    const callbackUrl = targetTab ? `/?tab=${targetTab}` : "/";
    signIn("credentials", { callbackUrl });
  }

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
            <UserMenu
              onSignedOutClick={handleSignedOutClick}
              targetTab={activeTab}
            />
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

interface LoginFormProps {
  authError: string | null;
  initialMode: "login" | "signup";
}

function LoginForm({ authError, initialMode }: LoginFormProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim() || !password) {
      setLocalError("Please enter username and password");
      return;
    }

    setLoading(true);
    const res = await signIn("credentials", {
      username,
      password,
      mode,
      redirect: false,
    });
    setLoading(false);

    if (!res?.ok) {
      // NextAuth wraps error in "CredentialsSignin" — extract real message
      // from URL if present, otherwise show generic
      const url = res?.url;
      if (url) {
        const params = new URL(url).searchParams;
        const errorParam = params.get("error");
        if (errorParam && errorParam !== "CredentialsSignin") {
          setLocalError(errorParam);
          return;
        }
      }
      setLocalError(
        mode === "signup"
          ? "Sign up failed. Username may already be taken."
          : "Invalid username or password."
      );
      return;
    }

    // Success — NextAuth will refresh the page session automatically
    window.location.reload();
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
        <CardContent className="space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-md">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setLocalError(null);
              }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setLocalError(null);
              }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create account
            </button>
          </div>

          {(authError || localError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {mode === "signup" ? "Sign up error" : "Sign-in error"}
              </AlertTitle>
              <AlertDescription>{localError ?? authError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="your_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_-]+"
                title="Letters, numbers, underscore, hyphen only"
              />
              <p className="text-xs text-muted-foreground">
                3-30 characters: letters, numbers, underscore, hyphen
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 6 characters
              </p>
            </div>
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {mode === "signup" ? "Creating account…" : "Signing in…"}
                </>
              ) : (
                mode === "signup" ? "Create account" : "Sign in"
              )}
            </Button>
          </form>

          <div className="text-xs text-muted-foreground space-y-1">
            {mode === "login" ? (
              <p>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setLocalError(null);
                  }}
                  className="text-primary underline hover:no-underline"
                >
                  Create one
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setLocalError(null);
                  }}
                  className="text-primary underline hover:no-underline"
                >
                  Sign in
                </button>
              </p>
            )}
            <p className="text-muted-foreground/70">
              No email required. Your data stays on this server only.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
