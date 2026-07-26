"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Headphones,
  Play,
  Pause,
  Mic,
  Square,
  RotateCcw,
  Save,
} from "lucide-react";
import type { TextDTO, ShadowSessionDTO, CEFRLevel } from "@/lib/types";
import { getTexts, createShadowSession, getShadowSessions } from "@/lib/storage";

interface ShadowTabProps {
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

export function ShadowTab({ userId }: ShadowTabProps) {
  const [texts, setTexts] = useState<TextDTO[]>([]);
  const [sessions, setSessions] = useState<ShadowSessionDTO[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [t, s] = await Promise.all([
        getTexts(userId),
        getShadowSessions(userId),
      ]);
      if (!cancelled) {
        setTexts(t);
        setSessions(s);
        if (t.length > 0) setSelectedTextId(t[0].id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      // Cleanup speech synthesis
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      // Cleanup media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [userId]);

  const selectedText = useMemo(
    () => texts.find((t) => t.id === selectedTextId) ?? null,
    [texts, selectedTextId]
  );

  // Split text into sentences for shadowing
  const sentences = useMemo(() => {
    if (!selectedText) return [];
    return selectedText.content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [selectedText]);

  function handlePlay() {
    if (!selectedText) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Your browser does not support speech synthesis");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(selectedText.content);
    u.lang = "en-US";
    u.rate = 0.95;
    u.onend = () => {
      setPlaying(false);
      setPaused(false);
    };
    u.onerror = () => {
      setPlaying(false);
      setPaused(false);
      toast.error("Speech playback error");
    };
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
    setPlaying(true);
    setPaused(false);
  }

  function handlePause() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }

  function handleStop() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setPlaying(false);
    setPaused(false);
  }

  async function handleStartRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e: unknown) {
      toast.error("Microphone access denied");
    }
  }

  function handleStopRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  function handleResetRecording() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }

  async function handleSaveSession() {
    if (!selectedText || !audioUrl) return;
    try {
      await createShadowSession(userId, {
        textId: selectedText.id,
        userRecordingUrl: audioUrl,
      });
      toast.success("Shadowing session saved");
      const s = await getShadowSessions(userId);
      setSessions(s);
    } catch (e: unknown) {
      toast.error("Failed to save session");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (texts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          You need to read a text first. Switch to the <strong>Read</strong> tab.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pick a text to shadow</CardTitle>
            <CardDescription>
              Listen to the text with text-to-speech, then record yourself repeating.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="shadow-text-select">Text</Label>
              <Select value={selectedTextId} onValueChange={setSelectedTextId}>
                <SelectTrigger id="shadow-text-select">
                  <SelectValue placeholder="Pick a text" />
                </SelectTrigger>
                <SelectContent>
                  {texts.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title} ({t.cefrLevel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedText && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{selectedText.title}</CardTitle>
                  <CardDescription className="text-xs">
                    {sentences.length} sentences
                  </CardDescription>
                </div>
                <Badge className={CEFR_COLOR[selectedText.cefrLevel]}>
                  {selectedText.cefrLevel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Audio playback controls */}
              <div className="border rounded-md p-3 space-y-3 bg-accent/30">
                <div className="text-xs text-muted-foreground font-medium">
                  Original audio (TTS)
                </div>
                <div className="flex items-center gap-2">
                  {!playing ? (
                    <Button onClick={handlePlay} size="sm">
                      <Play className="w-4 h-4 mr-1.5" />
                      Play
                    </Button>
                  ) : (
                    <Button onClick={handlePause} size="sm" variant="secondary">
                      <Pause className="w-4 h-4 mr-1.5" />
                      {paused ? "Resume" : "Pause"}
                    </Button>
                  )}
                  <Button onClick={handleStop} size="sm" variant="outline">
                    <Square className="w-3.5 h-3.5 mr-1.5" />
                    Stop
                  </Button>
                </div>
              </div>

              {/* Recording controls */}
              <div className="border rounded-md p-3 space-y-3">
                <div className="text-xs text-muted-foreground font-medium">
                  Your recording
                </div>
                <div className="flex items-center gap-2">
                  {!recording ? (
                    <Button onClick={handleStartRecording} size="sm" variant="destructive">
                      <Mic className="w-4 h-4 mr-1.5" />
                      Record
                    </Button>
                  ) : (
                    <Button onClick={handleStopRecording} size="sm">
                      <Square className="w-3.5 h-3.5 mr-1.5" />
                      Stop recording
                    </Button>
                  )}
                  {audioUrl && (
                    <Button onClick={handleResetRecording} size="sm" variant="outline">
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      Discard
                    </Button>
                  )}
                  {audioUrl && (
                    <Button onClick={handleSaveSession} size="sm">
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      Save session
                    </Button>
                  )}
                </div>
                {recording && (
                  <div className="text-xs text-rose-600 animate-pulse">
                    ● Recording…
                  </div>
                )}
                {audioUrl && (
                  <audio controls src={audioUrl} className="w-full" />
                )}
              </div>

              {/* Text content for visual reference */}
              <div className="border-l-2 pl-3 text-sm leading-relaxed max-h-60 overflow-y-auto">
                {sentences.map((s, i) => (
                  <p key={i} className="mb-1">
                    {s}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Headphones className="w-4 h-4" />
            Shadow history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            <ScrollArea className="h-80">
              <div className="space-y-2 pr-2">
                {sessions.map((s) => {
                  const text = texts.find((t) => t.id === s.textId);
                  return (
                    <div
                      key={s.id}
                      className="border rounded-md p-2 text-sm"
                    >
                      <div className="font-medium truncate">
                        {text?.title ?? "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.completedAt).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
