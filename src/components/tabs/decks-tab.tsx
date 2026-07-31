"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Library, Check, Plus, ArrowRight, BookOpen } from "lucide-react";

interface DecksTabProps {
  userId: string;
  onNavigate: (tab: string, deckId?: string) => void;
}

interface DeckIndex {
  id: string;
  name: string;
  description: string;
  category: string;
  wordCount: number;
  source: string;
  license: string;
}

interface DeckProgress {
  totalWords: number;
  studiedWords: number;
  dueWords: number;
  masteryPercent: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  TOEIC: "bg-blue-100 text-blue-700 border-blue-200",
  IELTS: "bg-purple-100 text-purple-700 border-purple-200",
  Oxford: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Daily: "bg-amber-100 text-amber-700 border-amber-200",
  Essential: "bg-rose-100 text-rose-700 border-rose-200",
  CEFR: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

export function DecksTab({ userId, onNavigate }: DecksTabProps) {
  const [decks, setDecks] = useState<DeckIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, DeckProgress>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/data/decks/index.json");
        if (!res.ok) throw new Error("Failed to load decks");
        const data = await res.json();
        if (cancelled) return;
        setDecks(data);

        // Load subscription state + progress
        const { getSubscribedDecks, getDeckProgress } = await import("@/lib/deck-storage");
        const subs = await getSubscribedDecks();
        setSubscribed(new Set(subs));

        const progMap: Record<string, DeckProgress> = {};
        for (const deck of data) {
          progMap[deck.id] = await getDeckProgress(deck.id, deck.wordCount);
        }
        if (!cancelled) setProgress(progMap);
      } catch (err) {
        toast.error("Failed to load decks");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleToggleSubscribe(deckId: string) {
    const { subscribeToDeck, unsubscribeFromDeck } = await import("@/lib/deck-storage");
    if (subscribed.has(deckId)) {
      await unsubscribeFromDeck(deckId);
      setSubscribed((prev) => {
        const next = new Set(prev);
        next.delete(deckId);
        return next;
      });
      toast.success("Unsubscribed from deck");
    } else {
      await subscribeToDeck(deckId);
      setSubscribed((prev) => new Set(prev).add(deckId));
      toast.success("Subscribed! Start studying in Flashcard tab.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Library className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">Vocabulary Decks</h3>
              <p className="text-sm text-muted-foreground">
                {decks.length} decks available · {decks.reduce((s, d) => s + d.wordCount, 0).toLocaleString()} words total
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-2">
          {decks.map((deck) => {
            const isSubbed = subscribed.has(deck.id);
            const prog = progress[deck.id];
            return (
              <Card key={deck.id} className="flex flex-col">
                <CardContent className="p-5 flex-1 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base leading-tight">
                        {deck.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {deck.wordCount.toLocaleString()} words
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={CATEGORY_COLORS[deck.category] || "bg-muted"}
                    >
                      {deck.category}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                    {deck.description}
                  </p>

                  {isSubbed && prog && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {prog.studiedWords}/{prog.totalWords} studied
                        </span>
                        <span className="text-muted-foreground">
                          {prog.dueWords > 0 && (
                            <span className="text-orange-600 font-medium">
                              {prog.dueWords} due
                            </span>
                          )}
                        </span>
                      </div>
                      <Progress value={prog.masteryPercent} className="h-1.5" />
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {isSubbed ? (
                      <>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => onNavigate("study:flashcard", deck.id)}
                        >
                          <BookOpen className="w-4 h-4 mr-1.5" />
                          Study
                        </Button>
                        {prog && prog.dueWords > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onNavigate("study:review", deck.id)}
                          >
                            Review ({prog.dueWords})
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleSubscribe(deck.id)}
                        >
                          Unsubscribe
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleToggleSubscribe(deck.id)}
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Subscribe
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// Inline Card component to avoid import issues
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 ${className}`}>{children}</div>;
}
