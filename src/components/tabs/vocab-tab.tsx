"use client";

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { NotebookPen, Search } from "lucide-react";
import { PronounceButton } from "@/components/pronounce-button";
import type { VocabItemDTO, MemoryItemDTO, CEFRLevel } from "@/lib/types";
import { getVocabItems, getMemoryItems } from "@/lib/storage";
import { estimateRecallProbability } from "@/lib/mastery-engine";
import { CEFR_COLOR } from "@/lib/level-colors";

interface VocabTabProps {
  userId: string;
}

export function VocabTab({ userId }: VocabTabProps) {
  const [vocabs, setVocabs] = useState<VocabItemDTO[]>([]);
  const [memories, setMemories] = useState<MemoryItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viCache, setViCache] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [v, m] = await Promise.all([
        getVocabItems(userId),
        getMemoryItems(userId),
      ]);
      if (!cancelled) {
        setVocabs(v);
        setMemories(m);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Auto-fetch Vietnamese translation for vocab items that don't have it
  useEffect(() => {
    if (vocabs.length === 0) return;
    let cancelled = false;

    (async () => {
      const toFetch = vocabs
        .filter((v) => !v.vietnamese && !viCache[v.word])
        .slice(0, 5); // limit concurrent fetches

      for (const v of toFetch) {
        if (cancelled) break;
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: v.word, target: "vi" }),
          });
          if (!res.ok) continue;
          const data = await res.json();
          if (data.translation && !cancelled) {
            setViCache((prev) => ({ ...prev, [v.word]: data.translation }));
          }
        } catch {
          // silent fail
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vocabs, viCache]);

  const memoryMap = useMemo(() => {
    const map = new Map<string, MemoryItemDTO>();
    for (const m of memories) map.set(m.id, m);
    return map;
  }, [memories]);

  const enriched = useMemo(() => {
    return vocabs
      .map((v) => {
        const m = memoryMap.get(v.memoryItemId);
        if (!m) return null;
        // FSRS: estimate retention from card stability + last review
        const recall = m.card.last_review
          ? estimateRecallProbability({
              stability: m.card.stability,
              lastReview: m.card.last_review,
            })
          : 0;
        return { vocab: v, memory: m, recallProb: recall };
      })
      .filter((x): x is { vocab: VocabItemDTO; memory: MemoryItemDTO; recallProb: number } => x !== null);
  }, [vocabs, memoryMap]);

  const filtered = useMemo(() => {
    if (!search.trim()) return enriched;
    const q = search.toLowerCase();
    return enriched.filter(
      (x) =>
        x.vocab.word.toLowerCase().includes(q) ||
        x.vocab.definition.toLowerCase().includes(q)
    );
  }, [enriched, search]);

  // Sort by recall prob ascending (most urgent first)
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.recallProb - b.recallProb),
    [filtered]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (vocabs.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <NotebookPen className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Sổ từ của bạn chưa có gì.</p>
          <p className="text-xs text-muted-foreground">
            Read a text and click highlighted words to save them here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm từ hoặc nghĩa…"
            className="border-0 focus-visible:ring-0"
          />
          <Badge variant="outline">{sorted.length} words</Badge>
        </CardContent>
      </Card>

      <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px]">
        <div className="space-y-2 pr-2">
          {sorted.map(({ vocab, memory, recallProb }) => {
            const isUrgent = recallProb < 0.5;
            return (
              <Card key={vocab.id} className={isUrgent ? "border-rose-300" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{vocab.word}</span>
                        {vocab.ipa && (
                          <span className="text-xs text-muted-foreground font-mono ml-1">
                            {vocab.ipa}
                          </span>
                        )}
                        <PronounceButton
                          word={vocab.word}
                          audioUrl={vocab.audioUrl}
                          className="ml-1"
                        />
                        <Badge
                          variant="outline"
                          className={CEFR_COLOR[vocab.cefrLevel]}
                        >
                          {vocab.cefrLevel}
                        </Badge>
                        {isUrgent && (
                          <Badge variant="destructive" className="text-xs">
                            Due
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">{vocab.definition}</p>
                      {(vocab.vietnamese || viCache[vocab.word]) && (
                        <p className="text-sm font-medium text-primary mt-1">
                          {vocab.vietnamese || viCache[vocab.word]}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        "{vocab.contextSentence}"
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        Reviewed {memory.card.reps}× · Last:{" "}
                        {memory.card.last_review
                          ? new Date(memory.card.last_review).toLocaleDateString()
                          : "never"}
                      </div>
                    </div>
                    <div className="text-right shrink-0 w-24">
                      <div className="text-xs text-muted-foreground">Recall</div>
                      <div className="text-lg font-bold">
                        {(recallProb * 100).toFixed(0)}%
                      </div>
                      <Progress value={recallProb * 100} className="h-1.5 mt-1" />
                    </div>
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
