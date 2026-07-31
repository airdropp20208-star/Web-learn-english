"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Volume2,
  RotateCcw,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface FlashcardTabProps {
  userId: string;
  initialDeckId?: string;
}

interface DeckWord {
  word: string;
  pos?: string;
  definition?: string;
  vietnamese?: string;
  example?: string;
  exampleVietnamese?: string;
  ipa?: string;
  audioUrl?: string;
  topic?: string;
  cefrLevel?: string;
}

interface Deck {
  id: string;
  name: string;
  words: DeckWord[];
}

export function FlashcardTab({ userId, initialDeckId }: FlashcardTabProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studiedCount, setStudiedCount] = useState(0);
  const [viTranslation, setViTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Load deck index
        const indexRes = await fetch("/data/decks/index.json");
        if (!indexRes.ok) throw new Error("Failed to load deck index");
        const index = await indexRes.json();

        // Load subscribed decks
        const { getSubscribedDecks } = await import("@/lib/deck-storage");
        const subs = await getSubscribedDecks();

        if (subs.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }

        // Load full deck data for subscribed decks
        const loadedDecks: Deck[] = [];
        for (const deckId of subs) {
          const meta = index.find((d: any) => d.id === deckId);
          if (!meta) continue;
          const res = await fetch(`/data/decks/${deckId}.json`);
          if (!res.ok) continue;
          const data = await res.json();
          loadedDecks.push(data);
        }

        if (cancelled) return;
        setDecks(loadedDecks);

        // Select initial deck or first one
        const initial = initialDeckId
          ? loadedDecks.find((d) => d.id === initialDeckId)
          : loadedDecks[0];
        if (initial) {
          setSelectedDeck(initial);
        }
      } catch (err) {
        toast.error("Failed to load flashcards");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, initialDeckId]);

  const currentWord = selectedDeck?.words[currentIdx];

  // Reset + auto-fetch Vietnamese translation when card changes
  useEffect(() => {
    if (!currentWord) return;
    setViTranslation(currentWord.vietnamese ?? null);
    setFlipped(false);

    // If no Vietnamese in dataset, fetch from /api/translate
    if (!currentWord.vietnamese && currentWord.word) {
      let cancelled = false;
      setTranslating(true);
      (async () => {
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: currentWord.word, target: "vi" }),
          });
          if (!res.ok) return;
          const data = await res.json();
          if (!cancelled && data.translation) {
            setViTranslation(data.translation);
          }
        } catch (err) {
          // silent fail — VI is optional
        } finally {
          if (!cancelled) setTranslating(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [currentWord]);

  const handleNext = useCallback(async () => {
    if (!selectedDeck || !currentWord) return;
    // Mark current word as studied
    try {
      const { markWordStudied } = await import("@/lib/deck-storage");
      const { createNewCard, serializeCard } = await import("@/lib/fsrs");
      let cardState: any;
      try {
        const card = createNewCard();
        cardState = JSON.parse(serializeCard(card));
      } catch {
        cardState = {
          due: new Date().toISOString(),
          stability: 0,
          difficulty: 0,
          elapsed_days: 0,
          scheduled_days: 0,
          reps: 0,
          lapses: 0,
          state: 0,
          last_review: null,
        };
      }
      await markWordStudied(selectedDeck.id, currentIdx, currentWord.word, cardState);
      setStudiedCount((c) => c + 1);
    } catch (e) {
      console.error("[flashcard] Failed to mark studied:", e);
    }

    setFlipped(false);
    if (currentIdx + 1 < selectedDeck.words.length) {
      setCurrentIdx((i) => i + 1);
    } else {
      toast.success(`Finished deck! Studied ${studiedCount + 1} words.`);
      setCurrentIdx(0);
    }
  }, [selectedDeck, currentIdx, currentWord, studiedCount]);

  const handlePrev = () => {
    setFlipped(false);
    setCurrentIdx((i) => Math.max(0, i - 1));
  };

  const playAudio = () => {
    if (currentWord?.audioUrl) {
      new Audio(currentWord.audioUrl).play().catch(() => {
        toast.error("Audio playback failed");
      });
    } else if (currentWord?.word) {
      // Fallback: Web Speech API
      try {
        const utterance = new SpeechSynthesisUtterance(currentWord.word);
        utterance.lang = "en-US";
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      } catch {
        toast.error("Text-to-speech not available");
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">
            No decks subscribed yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Go to the <strong>Decks</strong> tab to subscribe to a vocabulary deck.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!selectedDeck || !currentWord) {
    return null;
  }

  const progress = ((currentIdx + 1) / selectedDeck.words.length) * 100;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Deck selector */}
      {decks.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {decks.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setSelectedDeck(d);
                setCurrentIdx(0);
                setFlipped(false);
                setStudiedCount(0);
              }}
              className={`px-3 py-1.5 rounded-md text-xs border ${
                d.id === selectedDeck.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-accent"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {/* Progress */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{selectedDeck.name}</span>
            <span className="text-muted-foreground">
              {currentIdx + 1} / {selectedDeck.words.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          {studiedCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Studied {studiedCount} words this session
            </p>
          )}
        </CardContent>
      </Card>

      {/* Flashcard */}
      <Card className="min-h-[320px] flex">
        <CardContent className="p-6 flex-1 flex flex-col">
          <div
            className="flex-1 flex flex-col items-center justify-center cursor-pointer select-none"
            onClick={() => setFlipped(!flipped)}
          >
            {!flipped ? (
              /* Front: word + IPA + audio + Vietnamese meaning */
              <div className="text-center space-y-4">
                <div className="text-4xl font-bold">{currentWord.word}</div>
                {currentWord.ipa && (
                  <div className="flex items-center justify-center gap-2 text-lg text-muted-foreground font-mono">
                    <span>{currentWord.ipa}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playAudio();
                      }}
                      className="hover:text-primary"
                      title="Play pronunciation"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
                {currentWord.pos && (
                  <Badge variant="outline">{currentWord.pos}</Badge>
                )}
                {currentWord.topic && (
                  <Badge variant="secondary">{currentWord.topic}</Badge>
                )}
                {viTranslation && (
                  <div className="border-t pt-3 mt-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Nghĩa tiếng Việt
                    </div>
                    <div className="text-xl font-medium text-primary">
                      {viTranslation}
                    </div>
                  </div>
                )}
                {translating && !viTranslation && (
                  <div className="text-sm text-muted-foreground animate-pulse">
                    Đang dịch...
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  Click card to flip →
                </p>
              </div>
            ) : (
              /* Back: definition + example + Vietnamese */
              <div className="space-y-4 w-full">
                <div className="text-center">
                  <div className="text-2xl font-semibold">{currentWord.word}</div>
                  {currentWord.ipa && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground font-mono mt-1">
                      <span>{currentWord.ipa}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playAudio();
                        }}
                        className="hover:text-primary"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {viTranslation && (
                  <div className="bg-primary/5 p-3 rounded-md text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Nghĩa tiếng Việt
                    </div>
                    <p className="text-lg font-medium text-primary">{viTranslation}</p>
                  </div>
                )}
                {currentWord.definition && (
                  <div className="border-t pt-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Definition (EN)
                    </div>
                    <p className="text-sm">{currentWord.definition}</p>
                  </div>
                )}
                {currentWord.example && (
                  <div className="border-t pt-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Example
                    </div>
                    <p className="text-sm italic">"{currentWord.example}"</p>
                    {currentWord.exampleVietnamese && (
                      <p className="text-xs text-muted-foreground mt-1">
                        → {currentWord.exampleVietnamese}
                      </p>
                    )}
                  </div>
                )}
                {!currentWord.definition && !viTranslation && (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    No definition available for this word.
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={handlePrev} disabled={currentIdx === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <Button variant="secondary" onClick={() => setFlipped(!flipped)}>
          <RotateCcw className="w-4 h-4 mr-1" />
          Flip
        </Button>

        <Button onClick={handleNext}>
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setCurrentIdx(0);
            setFlipped(false);
            setStudiedCount(0);
            toast.info("Restarted deck");
          }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Restart deck
        </Button>
      </div>
    </div>
  );
}

// Inline Card component
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
