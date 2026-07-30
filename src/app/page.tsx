"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  Github,
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

  // Derive initial tab + error from URL once (no setState in effect)
  const initialTab = (() => {
    const tab = searchParams.get("tab") as TabId | null;
    return tab && TABS.some((t) => t.id === tab) ? tab : "read";
  })();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const authError = (() => {
    const error = searchParams.get("error");
    if (!error) return null;
    const errorMessages: Record<string, string> = {
      OAuthSignin: "GitHub OAuth could not be initiated. Check if GITHUB_ID and GITHUB_SECRET are set.",
      OAuthCallback: "GitHub OAuth callback failed. The OAuth App callback URL may be misconfigured.",
      OAuthCreateAccount: "Could not create user account from GitHub profile.",
      Configuration: "NextAuth configuration error. Ensure NEXTAUTH_SECRET and NEXTAUTH_URL are set.",
      default: "Sign-in failed. Please try again.",
    };
    return errorMessages[error] ?? errorMessages.default;
  })();

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (!session) {
    return <LoginForm authError={authError} />;
  }

  const userId = (session.user as { id?: string })?.id;
  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Session error</CardTitle>
            <CardDescription>
              User ID missing from session. This usually means the sign-in
              callback failed to upsert the user in the database. Sign out and
              try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => signIn("github", { callbackUrl: "/" })} variant="outline">
              Re-sign-in with GitHub
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const active = TABS.find((t) => t.id === activeTab)!;

  // Smart redirect: when user clicks a tab while signed out, we redirect to
  // sign-in with ?tab=<id> so after login we restore the tab.
  function handleSignedOutClick(targetTab?: string) {
    const callbackUrl = targetTab ? `/?tab=${targetTab}` : "/";
    signIn("github", { callbackUrl });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
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

function LoginForm({ authError }: { authError: string | null }) {
  const [loading, setLoading] = useState(false);

  async function handleGitHubSignIn() {
    setLoading(true);
    // signIn with redirect (not popup) for better mobile compat
    // callbackUrl "/" — HomeContent will read ?tab= to restore tab
    await signIn("github", { callbackUrl: "/" });
    // signIn triggers a redirect, this line may not execute
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
          <p className="text-sm text-muted-foreground">
            Sign in with your GitHub account to start reading, learning
            vocabulary, and tracking your progress.
          </p>

          {authError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sign-in error</AlertTitle>
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleGitHubSignIn}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            <Github className="w-5 h-5 mr-2" />
            {loading ? "Redirecting to GitHub…" : "Sign in with GitHub"}
          </Button>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>First time here?</strong> Just sign in with GitHub — your
              account will be created automatically.
            </p>
            <p>
              We only read your public GitHub profile and email. No password to
              remember, no spam.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
