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
import type { VocabItemDTO, MemoryItemDTO, CEFRLevel } from "@/lib/types";
import { getVocabItems, getMemoryItems } from "@/lib/storage";
import { estimateRecallProbability } from "@/lib/mastery-engine";

interface VocabTabProps {
  userId: string;
}

const CEFR_COLOR: Record<CEFRLevel, string> = {
  A1: "bg-emerald-100 text-emerald-700 border-emerald-200",
  A2: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B1: "bg-amber-100 text-amber-700 border-amber-200",
  B2: "bg-orange-100 text-orange-700 border-orange-200",
  C1: "bg-rose-100 text-rose-700 border-rose-200",
  C2: "bg-red-100 text-red-700 border-red-200",
};

export function VocabTab({ userId }: VocabTabProps) {
  const [vocabs, setVocabs] = useState<VocabItemDTO[]>([]);
  const [memories, setMemories] = useState<MemoryItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
        const recall = estimateRecallProbability(m);
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
          <p className="text-muted-foreground">Your vocabulary notebook is empty.</p>
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
            placeholder="Search words or definitions…"
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
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        "{vocab.contextSentence}"
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        Reviewed {memory.correctHistory.length}× · Last:{" "}
                        {new Date(memory.lastReviewedAt).toLocaleDateString()}
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
