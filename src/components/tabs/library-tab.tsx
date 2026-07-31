"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { BookOpen, Volume2, ArrowLeft, Sparkles } from "lucide-react";
import type { CEFRLevel, AnalyzeResponse } from "@/lib/types";
import { createText, saveVocabItem } from "@/lib/storage";

interface LibraryTabProps {
  userId: string;
}

interface ReadingText {
  id: string;
  level: CEFRLevel;
  title: string;
  category: string;
  content: string;
  wordCount: number;
}

const CEFR_COLOR: Record<CEFRLevel, string> = {
  A1: "bg-emerald-100 text-emerald-700 border-emerald-200",
  A2: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B1: "bg-amber-100 text-amber-700 border-amber-200",
  B2: "bg-orange-100 text-orange-700 border-orange-200",
  C1: "bg-rose-100 text-rose-700 border-rose-200",
  C2: "bg-red-100 text-red-700 border-red-200",
};

export function LibraryTab({ userId }: LibraryTabProps) {
  const [texts, setTexts] = useState<ReadingText[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<CEFRLevel | "all">("all");
  const [selectedText, setSelectedText] = useState<ReadingText | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    async function loadTexts() {
      try {
        const res = await fetch("/data/reading.json");
        if (!res.ok) throw new Error("Failed to load reading library");
        const data = await res.json();
        setTexts(data);
      } catch (err) {
        toast.error("Failed to load reading library");
      } finally {
        setLoading(false);
      }
    }
    loadTexts();
  }, []);

  const filteredTexts = useMemo(() => {
    if (filterLevel === "all") return texts;
    return texts.filter((t) => t.level === filterLevel);
  }, [texts, filterLevel]);

  async function handleAnalyzeAndImport(text: ReadingText) {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.content }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Analyze failed (${res.status})`);
      }
      const data: AnalyzeResponse = await res.json();
      console.log("[library] Analyze result:", data.highlightedWords?.length, "words");

      // Save text to user's library
      const savedText = await createText(userId, {
        title: text.title,
        content: text.content,
        cefrLevel: data.cefrLevel,
        summary: data.summary,
        readability: data.readability,
      });
      console.log("[library] Saved text:", savedText.id);

      // Auto-save all highlighted words as vocab
      let savedCount = 0;
      for (const word of data.highlightedWords) {
        try {
          // Fetch Vietnamese translation for this word
          let vietnamese: string | null = null;
          try {
            const transRes = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: word.word, target: "vi" }),
            });
            if (transRes.ok) {
              const transData = await transRes.json();
              if (transData.translation) vietnamese = transData.translation;
            }
          } catch {
            // translation optional
          }

          await saveVocabItem(userId, {
            word: word.word,
            definition: word.definition,
            vietnamese,
            exampleSentence: word.example,
            contextSentence: word.contextSentence,
            cefrLevel: word.cefrLevel,
            ipa: word.ipa,
            audioUrl: word.audioUrl,
            sourceTextId: savedText.id,
          });
          savedCount++;
        } catch (e) {
          console.error("[library] Failed to save vocab word:", word.word, e);
        }
      }
      console.log("[library] Saved", savedCount, "vocab words");

      toast.success(`Imported "${text.title}" with ${savedCount} vocabulary words`);
      setSelectedText(null);
    } catch (err) {
      console.error("[library] Import failed:", err);
      toast.error(`Failed to import: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (selectedText) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedText(null)}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to library
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">{selectedText.title}</CardTitle>
                <CardDescription>
                  {selectedText.category} · {selectedText.wordCount} words
                </CardDescription>
              </div>
              <Badge className={CEFR_COLOR[selectedText.level]}>
                {selectedText.level}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed">
              {selectedText.content}
            </div>
            <Button
              onClick={() => handleAnalyzeAndImport(selectedText)}
              disabled={analyzing}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {analyzing ? "Analyzing & importing…" : "Analyze & import to my library"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              This will extract vocabulary with definitions, IPA, and audio — then add it to your Vocab list.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium mr-2">Level:</span>
            <button
              onClick={() => setFilterLevel("all")}
              className={`px-3 py-1 rounded-md text-sm ${
                filterLevel === "all"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              All ({texts.length})
            </button>
            {(["A1", "A2", "B1", "B2", "C1", "C2"] as CEFRLevel[]).map((level) => {
              const count = texts.filter((t) => t.level === level).length;
              if (count === 0) return null;
              return (
                <button
                  key={level}
                  onClick={() => setFilterLevel(level)}
                  className={`px-3 py-1 rounded-md text-sm border ${
                    filterLevel === level
                      ? "bg-primary text-primary-foreground border-primary"
                      : CEFR_COLOR[level] + " hover:opacity-80"
                  }`}
                >
                  {level} ({count})
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {filteredTexts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No texts at this level.
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-2">
            {filteredTexts.map((text) => (
              <Card
                key={text.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedText(text)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-sm leading-tight">
                      {text.title}
                    </h3>
                    <Badge
                      variant="outline"
                      className={CEFR_COLOR[text.level] + " shrink-0"}
                    >
                      {text.level}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {text.category} · {text.wordCount} words
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {text.content.substring(0, 120)}…
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
