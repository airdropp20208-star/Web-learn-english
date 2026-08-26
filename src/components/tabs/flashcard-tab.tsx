"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Rating } from "ts-fsrs";
import { BookOpen, Volume2, RotateCcw, Play, Sparkles } from "lucide-react";
import type { FSRSCardState } from "@/lib/types";
import {
  createNewCard,
  reviewCard,
  serializeCard,
  deserializeCard,
  type ReviewRating,
} from "@/lib/fsrs";
import {
  getSubscribedDecks,
  getDeckCardStates,
  markWordStudied,
  isCardStateDue,
} from "@/lib/deck-storage";
import { award } from "@/lib/gamification";

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

interface DeckMeta {
  id: string;
  name: string;
  wordCount: number;
}

interface QueueEntry {
  index: number;
  word: DeckWord;
  isNew: boolean;
}

const SESSION_SIZE = 20;

// Dùng tên mức đánh giá của ts-fsrs (Manual=0, Again=1, Hard=2, Good=3, Easy=4).
// Gõ số trần là sai lệch một bậc và "Quá dễ" sẽ trỏ vào mức không tồn tại.
const RATINGS: Array<{ rating: ReviewRating; label: string; className: string }> = [
  { rating: Rating.Again, label: "Chưa nhớ", className: "bg-red-500 hover:bg-red-600" },
  { rating: Rating.Hard, label: "Khó", className: "bg-orange-500 hover:bg-orange-600" },
  { rating: Rating.Good, label: "Nhớ", className: "bg-green-600 hover:bg-green-700" },
  { rating: Rating.Easy, label: "Quá dễ", className: "bg-blue-500 hover:bg-blue-600" },
];

export function FlashcardTab({ userId, initialDeckId }: FlashcardTabProps) {
  const [decks, setDecks] = useState<DeckMeta[]>([]);
  const [subscribed, setSubscribed] = useState<string[]>([]);
  const [deckId, setDeckId] = useState<string | null>(initialDeckId ?? null);
  const [words, setWords] = useState<DeckWord[]>([]);
  const [cardStates, setCardStates] = useState<Record<string, FSRSCardState>>({});
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [learnedCount, setLearnedCount] = useState(0);

  // Tải danh sách deck + deck nào đã đăng ký
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/decks/index.json");
        const all: DeckMeta[] = await res.json();
        const subs = await getSubscribedDecks();
        if (cancelled) return;
        setDecks(all);
        setSubscribed(subs);
        setDeckId((current) => current ?? subs[0] ?? null);
      } catch {
        if (!cancelled) toast.error("Không tải được danh sách bộ từ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const buildQueue = useCallback(
    (deckWords: DeckWord[], states: Record<string, FSRSCardState>) => {
      const now = Date.now();
      const dueEntries: QueueEntry[] = [];
      const newEntries: QueueEntry[] = [];

      deckWords.forEach((word, index) => {
        const state = states[word.word];
        if (!state) {
          newEntries.push({ index, word, isNew: true });
        } else if (isCardStateDue(state, now)) {
          dueEntries.push({ index, word, isNew: false });
        }
      });

      // Ôn từ đến hạn trước, còn chỗ thì bổ sung từ mới
      const session = [
        ...dueEntries.slice(0, SESSION_SIZE),
        ...newEntries.slice(0, Math.max(0, SESSION_SIZE - dueEntries.length)),
      ];

      setQueue(session);
      setPosition(0);
      setFlipped(false);
      setLearnedCount(0);
    },
    []
  );

  // Tải từ của deck đang chọn
  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    (async () => {
      setLoadingDeck(true);
      try {
        const [res, states] = await Promise.all([
          fetch(`/data/decks/${deckId}.json`),
          getDeckCardStates(deckId),
        ]);
        if (!res.ok) throw new Error("deck not found");
        const deck: { words: DeckWord[] } = await res.json();
        if (cancelled) return;
        setWords(deck.words);
        setCardStates(states);
        buildQueue(deck.words, states);
      } catch {
        if (!cancelled) toast.error("Không tải được bộ từ này");
      } finally {
        if (!cancelled) setLoadingDeck(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deckId, buildQueue]);

  function speak(entry: DeckWord) {
    if (entry.audioUrl) {
      new Audio(entry.audioUrl).play().catch(() => fallbackSpeak(entry.word));
      return;
    }
    fallbackSpeak(entry.word);
  }

  function fallbackSpeak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function handleRate(rating: ReviewRating) {
    const entry = queue[position];
    if (!entry || !deckId) return;

    const previous = cardStates[entry.word.word];
    const card = previous
      ? deserializeCard(JSON.stringify(previous))
      : createNewCard();
    const { card: updated } = reviewCard(card, rating);
    const nextState: FSRSCardState = JSON.parse(serializeCard(updated));

    await markWordStudied(deckId, entry.index, entry.word.word, nextState);
    setCardStates((prev) => ({ ...prev, [entry.word.word]: nextState }));

    const { newAchievements } = award(entry.isNew ? "learn-word" : "review-word");
    newAchievements.forEach((a) => {
      toast.success(`🏅 ${a.name}: ${a.description}`, { duration: 5000 });
    });

    if (entry.isNew) setLearnedCount((n) => n + 1);

    // “Chưa nhớ” thì đẩy thẻ xuống cuối để gặp lại ngay trong buổi này
    if (rating === Rating.Again) {
      setQueue((prev) => [...prev, { ...entry, isNew: false }]);
    }

    setFlipped(false);
    setPosition((p) => p + 1);
  }

  if (loading) {
    return <div className="h-48 rounded-xl bg-muted animate-pulse" />;
  }

  if (subscribed.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card card-elevated p-8 text-center space-y-3">
        <BookOpen className="w-10 h-10 mx-auto text-muted-foreground" />
        <p className="font-medium">Bạn chưa chọn bộ từ nào</p>
        <p className="text-sm text-muted-foreground">
          Sang tab <strong>Bộ từ</strong> và bấm Đăng ký một bộ bất kỳ, rồi quay lại
          đây.
        </p>
      </div>
    );
  }

  const current = queue[position];
  const finished = !loadingDeck && queue.length > 0 && position >= queue.length;

  return (
    <div className="space-y-4">
      {/* Chọn bộ từ */}
      <div className="flex flex-wrap gap-2">
        {decks
          .filter((d) => subscribed.includes(d.id))
          .map((d) => (
            <button
              key={d.id}
              onClick={() => setDeckId(d.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                deckId === d.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-accent"
              }`}
            >
              {d.name}
            </button>
          ))}
      </div>

      {loadingDeck && <div className="h-56 rounded-xl bg-muted animate-pulse" />}

      {!loadingDeck && queue.length === 0 && (
        <div className="rounded-xl border border-border/70 bg-card card-elevated p-8 text-center space-y-3">
          <Sparkles className="w-10 h-10 mx-auto text-emerald-500" />
          <p className="font-medium">Không còn từ nào đến hạn</p>
          <p className="text-sm text-muted-foreground">
            Bạn đã học hết phần của hôm nay trong bộ này. Chọn bộ từ khác hoặc
            quay lại sau.
          </p>
        </div>
      )}

      {finished && (
        <div className="rounded-xl border border-border/70 bg-card card-elevated p-8 text-center space-y-4">
          <Sparkles className="w-10 h-10 mx-auto text-emerald-500" />
          <div>
            <p className="text-2xl font-bold">{queue.length}</p>
            <p className="text-sm text-muted-foreground">thẻ đã học xong</p>
          </div>
          {learnedCount > 0 && (
            <p className="text-sm text-emerald-600">
              Trong đó {learnedCount} từ hoàn toàn mới
            </p>
          )}
          <button
            onClick={() => buildQueue(words, cardStates)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium inline-flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Học tiếp
          </button>
        </div>
      )}

      {current && !finished && (
        <>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Thẻ {position + 1} / {queue.length}
              </span>
              <span>{current.isNew ? "Từ mới" : "Ôn lại"}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(position / queue.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card card-elevated p-8 min-h-[240px] flex flex-col items-center justify-center text-center gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold">{current.word.word}</h2>
              <button
                onClick={() => speak(current.word)}
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
                aria-label="Nghe phát âm"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>

            {current.word.ipa && (
              <p className="font-mono text-sm text-muted-foreground">
                {current.word.ipa}
              </p>
            )}

            {flipped ? (
              <div className="space-y-3 mt-2">
                <p className="text-lg font-medium">
                  {current.word.vietnamese ||
                    current.word.definition ||
                    "(bộ từ này chưa có nghĩa tiếng Việt)"}
                </p>
                {current.word.vietnamese && current.word.definition && (
                  <p className="text-sm text-muted-foreground">
                    {current.word.definition}
                  </p>
                )}
                {current.word.example && (
                  <div className="border-l-2 pl-3 text-left">
                    <p className="text-sm italic">{current.word.example}</p>
                    {current.word.exampleVietnamese && (
                      <p className="text-sm text-muted-foreground">
                        {current.word.exampleVietnamese}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">
                Tự nhẩm nghĩa trong đầu trước khi lật thẻ
              </p>
            )}
          </div>

          {flipped ? (
            <div>
              <p className="text-xs text-center text-muted-foreground mb-2">
                Bạn nhớ từ này tới đâu?
              </p>
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => handleRate(r.rating)}
                    className={`py-3 rounded-lg text-sm font-medium text-white transition-colors ${r.className}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setFlipped(true)}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
            >
              Lật thẻ
            </button>
          )}

          <button
            onClick={() => buildQueue(words, cardStates)}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Bắt đầu lại buổi học
          </button>
        </>
      )}
    </div>
  );
}
