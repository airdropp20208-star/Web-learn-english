"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Gamepad2, Check, X, Clock, Trophy, RotateCcw } from "lucide-react";

interface GamesTabProps {
  userId: string;
}

interface DeckWord {
  word: string;
  definition?: string;
  example?: string;
  ipa?: string;
}

interface Deck {
  id: string;
  name: string;
  words: DeckWord[];
}

type GameType = "match" | "spelling" | null;

export function GamesTab({ userId }: GamesTabProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<GameType>(null);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const indexRes = await fetch("/data/decks/index.json");
        if (!indexRes.ok) throw new Error("Failed to load");
        const index = await indexRes.json();

        const { getSubscribedDecks } = await import("@/lib/deck-storage");
        const subs = await getSubscribedDecks();

        const loadedDecks: Deck[] = [];
        for (const deckId of subs.length > 0 ? subs : index.slice(0, 2).map((d: any) => d.id)) {
          const meta = index.find((d: any) => d.id === deckId);
          if (!meta) continue;
          const res = await fetch(`/data/decks/${deckId}.json`);
          if (!res.ok) continue;
          loadedDecks.push(await res.json());
        }

        if (cancelled) return;
        setDecks(loadedDecks);
        if (loadedDecks.length > 0) setSelectedDeck(loadedDecks[0]);
      } catch (err) {
        toast.error("Failed to load games");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (activeGame === "match") {
    return <MatchGame deck={selectedDeck!} onExit={() => setActiveGame(null)} />;
  }

  if (activeGame === "spelling") {
    return <SpellingGame deck={selectedDeck!} onExit={() => setActiveGame(null)} />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">Mini-Games</h3>
              <p className="text-sm text-muted-foreground">
                Learn vocabulary through interactive games
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deck selector */}
      {decks.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm font-medium self-center mr-2">Deck:</span>
          {decks.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDeck(d)}
              className={`px-3 py-1.5 rounded-md text-xs border ${
                d.id === selectedDeck?.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-accent"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {/* Game cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" >
          <CardContent className="p-5" onClick={() => selectedDeck && setActiveGame("match")}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Match Words</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Match words with their definitions. Race against the clock!
                </p>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>60 seconds</span>
                  <Badge variant="outline">5 pairs</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-5" onClick={() => selectedDeck && setActiveGame("spelling")}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                <span className="text-purple-600 font-bold text-lg">Aa</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Spelling Bee</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Listen to the audio and type the word. Test your spelling!
                </p>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>10 words</span>
                  <Badge variant="outline">Audio required</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!selectedDeck && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Subscribe to a deck first in the Decks tab.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ Match Game ============

function MatchGame({ deck, onExit }: { deck: Deck; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const [pairs, setPairs] = useState<{ word: string; def: string; matched: boolean }[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // "word:idx" or "def:idx"
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameOver, setGameOver] = useState(false);

  // Generate round: pick 5 random words with definitions
  const generateRound = useCallback(() => {
    const wordsWithDefs = deck.words.filter((w) => w.definition);
    if (wordsWithDefs.length < 5) {
      toast.error("Deck needs at least 5 words with definitions");
      onExit();
      return;
    }
    const shuffled = [...wordsWithDefs].sort(() => Math.random() - 0.5).slice(0, 5);
    setPairs(shuffled.map((w) => ({ word: w.word, def: w.definition!, matched: false })));
    setSelected(null);
    setWrongPair(null);
  }, [deck, onExit]);

  useEffect(() => {
    generateRound();
  }, [generateRound]);

  // Timer
  useEffect(() => {
    if (gameOver) return;
    if (timeLeft <= 0) {
      setGameOver(true);
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, gameOver]);

  // Check win condition
  useEffect(() => {
    if (pairs.length > 0 && pairs.every((p) => p.matched)) {
      setScore((s) => s + 100 + timeLeft * 2);
      setRound((r) => r + 1);
      if (round + 1 >= 3) {
        setGameOver(true);
      } else {
        setTimeout(generateRound, 1000);
      }
    }
  }, [pairs, timeLeft, round, generateRound]);

  function handleClick(type: "word" | "def", idx: number) {
    if (pairs[idx].matched || gameOver) return;
    const key = `${type}:${idx}`;

    if (!selected) {
      setSelected(key);
      return;
    }

    const [selType, selIdx] = selected.split(":");
    const selIdxNum = parseInt(selIdx);

    if (selType === type) {
      // Same type — switch selection
      setSelected(key);
      return;
    }

    // Different type — check match
    if (selIdxNum === idx) {
      // Match!
      setPairs((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, matched: true } : p))
      );
      setSelected(null);
    } else {
      // Wrong
      setWrongPair([selected, key]);
      setTimeout(() => {
        setWrongPair(null);
        setSelected(null);
      }, 600);
    }
  }

  if (gameOver) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Game Over!</CardTitle>
          <CardDescription>You scored {score} points across {round} rounds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <Trophy className="w-12 h-12 mx-auto text-amber-500 mb-2" />
            <div className="text-3xl font-bold">{score}</div>
            <p className="text-sm text-muted-foreground mt-1">points</p>
          </div>
          <Button onClick={onExit} className="w-full">Back to games</Button>
        </CardContent>
      </Card>
    );
  }

  const wordIndices = [0, 1, 2, 3, 4];
  const shuffledDefIndices = [...wordIndices].sort(() => Math.random() - 0.5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}>← Exit</Button>
        <div className="flex items-center gap-3">
          <Badge variant="outline">Round {round + 1}/3</Badge>
          <Badge variant="outline">Score: {score}</Badge>
          <Badge variant={timeLeft < 10 ? "destructive" : "secondary"}>
            <Clock className="w-3 h-3 mr-1" />
            {timeLeft}s
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center mb-4">
            Match each word with its definition
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* Words column */}
            <div className="space-y-2">
              {wordIndices.map((idx) => {
                const pair = pairs[idx];
                if (!pair) return null;
                const selKey = `word:${idx}`;
                const isSelected = selected === selKey;
                const isWrong = wrongPair?.includes(selKey);
                return (
                  <button
                    key={`w-${idx}`}
                    onClick={() => handleClick("word", idx)}
                    disabled={pair.matched}
                    className={`w-full text-left px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                      pair.matched
                        ? "bg-emerald-100 dark:bg-emerald-950 border-emerald-300 opacity-50"
                        : isWrong
                        ? "bg-rose-100 dark:bg-rose-950 border-rose-400"
                        : isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    {pair.matched && <Check className="w-3 h-3 inline mr-1" />}
                    {pair.word}
                  </button>
                );
              })}
            </div>
            {/* Definitions column (shuffled) */}
            <div className="space-y-2">
              {shuffledDefIndices.map((defIdx) => {
                const pair = pairs[defIdx];
                if (!pair) return null;
                const selKey = `def:${defIdx}`;
                const isSelected = selected === selKey;
                const isWrong = wrongPair?.includes(selKey);
                return (
                  <button
                    key={`d-${defIdx}`}
                    onClick={() => handleClick("def", defIdx)}
                    disabled={pair.matched}
                    className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                      pair.matched
                        ? "bg-emerald-100 dark:bg-emerald-950 border-emerald-300 opacity-50"
                        : isWrong
                        ? "bg-rose-100 dark:bg-rose-950 border-rose-400"
                        : isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    {pair.matched && <Check className="w-3 h-3 inline mr-1" />}
                    {pair.def.length > 60 ? pair.def.substring(0, 60) + "…" : pair.def}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Spelling Game ============

function SpellingGame({ deck, onExit }: { deck: Deck; onExit: () => void }) {
  const [words, setWords] = useState<DeckWord[]>(() => {
    if (!deck) return [];
    const wordsWithAudio = deck.words.filter((w) => w.audioUrl || w.word);
    return [...wordsWithAudio].sort(() => Math.random() - 0.5).slice(0, 10);
  });
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState(0);

  const current = words[currentIdx];

  function playAudio() {
    if (!current) return;
    if (current.audioUrl) {
      new Audio(current.audioUrl).play().catch(() => {});
    } else {
      try {
        const u = new SpeechSynthesisUtterance(current.word);
        u.lang = "en-US";
        u.rate = 0.85;
        window.speechSynthesis.speak(u);
      } catch {}
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!current || result) return;
    if (input.trim().toLowerCase() === current.word.toLowerCase()) {
      setResult("correct");
      setScore((s) => s + 1);
    } else {
      setResult("wrong");
    }
  }

  function handleNext() {
    if (currentIdx + 1 >= words.length) {
      // Game over
      setCurrentIdx(0);
      setResult(null);
      setInput("");
      toast.success(`Spelling bee complete! Score: ${score}/${words.length}`);
      onExit();
      return;
    }
    setCurrentIdx((i) => i + 1);
    setInput("");
    setResult(null);
  }

  if (words.length === 0 || !current) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}>← Exit</Button>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{currentIdx + 1}/{words.length}</Badge>
          <Badge variant="outline">Score: {score}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Listen to the audio and type the word
          </p>

          <div className="flex justify-center">
            <Button onClick={playAudio} size="lg" className="rounded-full">
              <span className="text-2xl">🔊</span>
              <span className="ml-2">Play audio</span>
            </Button>
          </div>

          {result && (
            <div className={`text-center p-3 rounded-md ${result === "correct" ? "bg-emerald-50 dark:bg-emerald-950" : "bg-rose-50 dark:bg-rose-950"}`}>
              {result === "correct" ? (
                <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <Check className="w-5 h-5" />
                  <span>Correct!</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 text-rose-700 dark:text-rose-400">
                    <X className="w-5 h-5" />
                    <span>Incorrect</span>
                  </div>
                  <p className="text-sm">
                    Answer: <strong>{current.word}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={result !== null}
              placeholder="Type the word you hear…"
              autoFocus
              className="w-full px-4 py-3 rounded-md border bg-transparent text-center text-lg font-medium outline-none focus:border-primary"
            />
            {!result ? (
              <Button type="submit" className="w-full" disabled={!input.trim()}>
                Submit
              </Button>
            ) : (
              <Button type="button" onClick={handleNext} className="w-full">
                {currentIdx + 1 >= words.length ? "Finish" : "Next word"}
              </Button>
            )}
          </form>

          {result === "wrong" && current.definition && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              <span className="font-medium">Definition:</span> {current.definition}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
