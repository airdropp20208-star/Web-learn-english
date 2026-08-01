"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Brain,
  Check,
  Clock,
  Gamepad2,
  Shuffle,
  Swords,
  ThumbsUp,
  Trophy,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import type { FSRSCardState } from "@/lib/types";
import {
  meaningOf,
  recordAnswer,
  shuffle,
  speakWord,
  isTypedAnswerCorrect,
  pickWords,
  type GameWord,
} from "@/lib/game-engine";
import { getDeckCardStates, getSubscribedDecks } from "@/lib/deck-storage";
import { award } from "@/lib/gamification";
import { getGameComment } from "@/lib/humor";
import { WordBattle } from "@/components/games/word-battle";
import { SpeedQuiz } from "@/components/games/speed-quiz";
import { WordScramble } from "@/components/games/word-scramble";
import { MemoryFlip } from "@/components/games/memory-flip";
import { TrueFalse } from "@/components/games/true-false";

interface GamesTabProps {
  userId: string;
}

interface DeckMeta {
  id: string;
  name: string;
}

interface LoadedDeck extends DeckMeta {
  words: GameWord[];
}

type GameType =
  | "battle"
  | "speed"
  | "match"
  | "memory"
  | "scramble"
  | "truefalse"
  | "spelling"
  | null;

interface GameDef {
  id: Exclude<GameType, null>;
  title: string;
  desc: string;
  meta: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}

const GAMES: GameDef[] = [
  {
    id: "battle",
    title: "Đấu trùm từ vựng",
    desc: "12 câu, 3 tim, combo nhân sát thương. Trả lời đúng để hạ boss.",
    meta: "Trộn 4 kiểu câu · 15 giây mỗi câu",
    icon: Swords,
    tone: "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
  },
  {
    id: "speed",
    title: "Tốc chiến 60 giây",
    desc: "Trả lời càng nhanh càng nhiều. Chuỗi đúng liên tiếp nhân điểm.",
    meta: "60 giây · combo tới x3",
    icon: Zap,
    tone: "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
  },
  {
    id: "match",
    title: "Nối từ",
    desc: "Nối từ với nghĩa đúng trước khi hết giờ.",
    meta: "3 vòng · 5 cặp · 60 giây",
    icon: Trophy,
    tone: "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
  },
  {
    id: "memory",
    title: "Lật thẻ trí nhớ",
    desc: "12 thẻ úp. Lật 2 thẻ mỗi lượt để ghép từ với nghĩa.",
    meta: "2 vòng · 6 cặp · 120 giây",
    icon: Brain,
    tone: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400",
  },
  {
    id: "scramble",
    title: "Xếp chữ",
    desc: "Cho nghĩa, ghép các chữ cái bị xáo thành từ đúng.",
    meta: "8 từ · luyện nhớ mặt chữ",
    icon: Shuffle,
    tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
  },
  {
    id: "truefalse",
    title: "Đúng hay Sai",
    desc: "Cặp từ - nghĩa hiện ra, quyết định xem có khớp không.",
    meta: "20 cặp · 60 giây",
    icon: ThumbsUp,
    tone: "bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400",
  },
  {
    id: "spelling",
    title: "Nghe viết chính tả",
    desc: "Nghe phát âm rồi gõ lại đúng từ.",
    meta: "10 từ · luyện nghe",
    icon: Volume2,
    tone: "bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400",
  },
];

export function GamesTab({ userId }: GamesTabProps) {
  const [decks, setDecks] = useState<LoadedDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<GameType>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [cardStates, setCardStates] = useState<Record<string, FSRSCardState>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const indexRes = await fetch("/data/decks/index.json");
        if (!indexRes.ok) throw new Error("failed");
        const index: DeckMeta[] = await indexRes.json();
        const subs = await getSubscribedDecks();
        const targetIds =
          subs.length > 0 ? subs : index.slice(0, 2).map((d) => d.id);

        const loaded: LoadedDeck[] = [];
        for (const deckId of targetIds) {
          const meta = index.find((d) => d.id === deckId);
          if (!meta) continue;
          const res = await fetch(`/data/decks/${deckId}.json`);
          if (!res.ok) continue;
          const deck = await res.json();
          loaded.push({
            id: meta.id,
            name: meta.name,
            words: (deck.words ?? []).map(
              (w: Omit<GameWord, "index">, i: number) => ({ ...w, index: i })
            ),
          });
        }

        if (cancelled) return;
        setDecks(loaded);
        setSelectedDeckId(loaded[0]?.id ?? null);
      } catch {
        if (!cancelled) toast.error("Không tải được bộ từ cho game");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /**
   * Nạp lịch ôn của bộ từ đang chọn.
   * Chỉ chạy khi đang ở menu — nếu nạp lúc đang chơi thì object cardStates
   * đổi tham chiếu và làm ván đang chơi bị dựng lại.
   */
  useEffect(() => {
    if (!selectedDeckId || activeGame !== null) return;
    let cancelled = false;
    (async () => {
      const states = await getDeckCardStates(selectedDeckId);
      if (!cancelled) setCardStates(states);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDeckId, activeGame]);

  const selectedDeck = useMemo(
    () => decks.find((d) => d.id === selectedDeckId) ?? null,
    [decks, selectedDeckId]
  );

  // Tham chiếu ổn định để các game con không bị reset khi tab này vẽ lại
  const handleExit = useCallback(() => setActiveGame(null), []);

  function startGame(game: Exclude<GameType, null>) {
    if (!selectedDeck) return;
    award("game-play");
    setActiveGame(game);
  }

  if (loading) {
    return <div className="h-48 rounded-xl bg-muted animate-pulse" />;
  }

  if (!selectedDeck) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center space-y-2">
        <Gamepad2 className="w-10 h-10 mx-auto text-muted-foreground" />
        <p className="font-medium">Chưa có bộ từ nào</p>
        <p className="text-sm text-muted-foreground">
          Sang tab Bộ từ đăng ký một bộ trước đã.
        </p>
      </div>
    );
  }

  if (activeGame === "battle") {
    return (
      <WordBattle
        deckId={selectedDeck.id}
        deckName={selectedDeck.name}
        words={selectedDeck.words}
        cardStates={cardStates}
        onExit={handleExit}
      />
    );
  }

  if (activeGame === "speed") {
    return (
      <SpeedQuiz
        deckId={selectedDeck.id}
        words={selectedDeck.words}
        cardStates={cardStates}
        onExit={handleExit}
      />
    );
  }

  if (activeGame === "memory") {
    return (
      <MemoryFlip
        deckId={selectedDeck.id}
        words={selectedDeck.words}
        cardStates={cardStates}
        onExit={handleExit}
      />
    );
  }

  if (activeGame === "scramble") {
    return (
      <WordScramble
        deckId={selectedDeck.id}
        words={selectedDeck.words}
        cardStates={cardStates}
        onExit={handleExit}
      />
    );
  }

  if (activeGame === "truefalse") {
    return (
      <TrueFalse
        deckId={selectedDeck.id}
        words={selectedDeck.words}
        cardStates={cardStates}
        onExit={handleExit}
      />
    );
  }

  if (activeGame === "match") {
    return (
      <MatchGame
        deck={selectedDeck}
        cardStates={cardStates}
        onExit={handleExit}
      />
    );
  }

  if (activeGame === "spelling") {
    return (
      <SpellingGame
        deck={selectedDeck}
        cardStates={cardStates}
        onExit={handleExit}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shrink-0">
          <Gamepad2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold">Chơi mà học</h3>
          <p className="text-sm text-muted-foreground">
            Mọi câu trả lời đều được ghi vào lịch ôn — chơi xong là nhớ thật.
          </p>
        </div>
      </div>

      {/* Chọn bộ từ */}
      <div className="flex gap-2 flex-wrap">
        {decks.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelectedDeckId(d.id)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              d.id === selectedDeckId
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-accent"
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {GAMES.map((game) => {
          const Icon = game.icon;
          return (
            <button
              key={game.id}
              onClick={() => startGame(game.id)}
              className="group rounded-2xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:card-elevated"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${game.tone}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold">{game.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {game.desc}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {game.meta}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ Nối từ ============

interface MatchPair {
  word: GameWord;
  meaning: string;
  matched: boolean;
}

const MATCH_ROUNDS = 3;
const MATCH_PAIRS = 5;

function MatchGame({
  deck,
  cardStates,
  onExit,
}: {
  deck: LoadedDeck;
  cardStates: Record<string, FSRSCardState>;
  onExit: () => void;
}) {
  const [round, setRound] = useState(0);
  const [pairs, setPairs] = useState<MatchPair[]>([]);
  /**
   * Thứ tự hiển thị cột nghĩa. Phải nằm trong state — bản cũ xáo ngay trong
   * lúc render nên đồng hồ đếm ngược làm cột nghĩa nhảy mỗi giây.
   */
  const [meaningOrder, setMeaningOrder] = useState<number[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameOver, setGameOver] = useState(false);

  const usableWords = useMemo(
    () => deck.words.filter((w) => meaningOf(w)),
    [deck.words]
  );

  // Giữ trong ref để việc sinh vòng chơi không phụ thuộc danh tính hàm/prop
  const statesRef = useRef(cardStates);
  const exitRef = useRef(onExit);
  useEffect(() => {
    exitRef.current = onExit;
  }, [onExit]);

  /**
   * Sinh vòng chơi đúng một lần mỗi khi số vòng đổi.
   * Cố tình chỉ phụ thuộc [round] — mọi thứ khác đều đọc qua ref, nên không
   * có đường nào để một lần vẽ lại bất kỳ làm xáo lại bàn chơi.
   */
  useEffect(() => {
    if (usableWords.length < MATCH_PAIRS) {
      toast.error(`Bộ từ này cần ít nhất ${MATCH_PAIRS} từ có nghĩa`);
      exitRef.current();
      return;
    }
    if (round >= MATCH_ROUNDS) return;

    const picked = pickWords(usableWords, statesRef.current, MATCH_PAIRS);
    setPairs(
      picked.map((word) => ({
        word,
        meaning: meaningOf(word) as string,
        matched: false,
      }))
    );
    setMeaningOrder(shuffle(picked.map((_, i) => i)));
    setSelected(null);
    setWrongPair(null);
  }, [round, usableWords]);

  // Đồng hồ chung cho cả ván
  useEffect(() => {
    if (gameOver) return;
    if (timeLeft <= 0) {
      setGameOver(true);
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [timeLeft, gameOver]);

  // Hoàn thành một vòng
  useEffect(() => {
    if (pairs.length === 0 || !pairs.every((p) => p.matched)) return;

    setScore((s) => s + 100 + timeLeft * 2);
    const nextRound = round + 1;
    setRound(nextRound);

    if (nextRound >= MATCH_ROUNDS) {
      setGameOver(true);
      const { newAchievements } = award("game-win");
      toast.success(getGameComment(true), { duration: 3000 });
      newAchievements.forEach((a) => {
        toast.success(`🏅 ${a.name}: ${a.description}`, { duration: 5000 });
      });
    }
    // chạy theo pairs, không thêm dep khác để tránh chạy lại thừa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs]);

  function handleClick(type: "word" | "meaning", idx: number) {
    if (gameOver || !pairs[idx] || pairs[idx].matched) return;
    const key = `${type}:${idx}`;

    if (!selected) {
      setSelected(key);
      return;
    }

    const [selType, selIdxRaw] = selected.split(":");
    if (selType === type) {
      setSelected(key);
      return;
    }

    const selIdx = Number(selIdxRaw);
    if (selIdx === idx) {
      setPairs((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, matched: true } : p))
      );
      setSelected(null);
      void recordAnswer(
        deck.id,
        pairs[idx].word,
        true,
        statesRef.current[pairs[idx].word.word]
      );
    } else {
      setWrongPair([selected, key]);
      void recordAnswer(
        deck.id,
        pairs[selIdx].word,
        false,
        statesRef.current[pairs[selIdx].word.word]
      );
      window.setTimeout(() => {
        setWrongPair(null);
        setSelected(null);
      }, 600);
    }
  }

  if (gameOver) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
        <Trophy className="w-12 h-12 mx-auto text-amber-500" />
        <div>
          <div className="text-3xl font-bold">{score}</div>
          <p className="text-sm text-muted-foreground">
            điểm sau {Math.min(round, MATCH_ROUNDS)} vòng
          </p>
        </div>
        <button
          onClick={onExit}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={onExit}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Thoát
        </button>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>
            Vòng {Math.min(round + 1, MATCH_ROUNDS)}/{MATCH_ROUNDS}
          </span>
          <span>{score} điểm</span>
          <span
            className={`flex items-center gap-1 tabular-nums ${
              timeLeft < 10 ? "text-rose-500 font-semibold" : ""
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {timeLeft}s
          </span>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground text-center mb-4">
          Nối từ với nghĩa của nó
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            {pairs.map((pair, idx) => {
              const key = `word:${idx}`;
              return (
                <MatchButton
                  key={key}
                  label={pair.word.word}
                  matched={pair.matched}
                  selected={selected === key}
                  wrong={wrongPair?.includes(key) ?? false}
                  bold
                  onClick={() => handleClick("word", idx)}
                />
              );
            })}
          </div>
          <div className="space-y-2">
            {meaningOrder.map((idx) => {
              const pair = pairs[idx];
              if (!pair) return null;
              const key = `meaning:${idx}`;
              return (
                <MatchButton
                  key={key}
                  label={
                    pair.meaning.length > 60
                      ? `${pair.meaning.slice(0, 60)}…`
                      : pair.meaning
                  }
                  matched={pair.matched}
                  selected={selected === key}
                  wrong={wrongPair?.includes(key) ?? false}
                  onClick={() => handleClick("meaning", idx)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchButton({
  label,
  matched,
  selected,
  wrong,
  bold,
  onClick,
}: {
  label: string;
  matched: boolean;
  selected: boolean;
  wrong: boolean;
  bold?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={matched}
      className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
        bold ? "font-medium" : ""
      } ${
        matched
          ? "bg-emerald-100 dark:bg-emerald-950 border-emerald-300 opacity-50"
          : wrong
            ? "bg-rose-100 dark:bg-rose-950 border-rose-400"
            : selected
              ? "bg-primary text-primary-foreground border-primary"
              : "hover:bg-accent"
      }`}
    >
      {matched && <Check className="w-3 h-3 inline mr-1" />}
      {label}
    </button>
  );
}

// ============ Nghe viết chính tả ============

function SpellingGame({
  deck,
  cardStates,
  onExit,
}: {
  deck: LoadedDeck;
  cardStates: Record<string, FSRSCardState>;
  onExit: () => void;
}) {
  const statesRef = useRef(cardStates);
  const [words] = useState<GameWord[]>(() =>
    pickWords(deck.words, statesRef.current, 10)
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = words[currentIdx];

  useEffect(() => {
    if (current) speakWord(current);
  }, [current]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!current || result) return;
    const correct = isTypedAnswerCorrect(input, current.word);
    setResult(correct ? "correct" : "wrong");
    if (correct) setScore((s) => s + 1);
    void recordAnswer(deck.id, current, correct, statesRef.current[current.word]);
  }

  function handleNext() {
    if (currentIdx + 1 >= words.length) {
      setFinished(true);
      const { newAchievements } = award(
        score >= words.length / 2 ? "game-win" : "game-play"
      );
      newAchievements.forEach((a) => {
        toast.success(`🏅 ${a.name}: ${a.description}`, { duration: 5000 });
      });
      return;
    }
    setCurrentIdx((i) => i + 1);
    setInput("");
    setResult(null);
  }

  if (words.length === 0 || !current) {
    return <div className="h-40 rounded-xl bg-muted animate-pulse" />;
  }

  if (finished) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
        <div className="text-4xl">{score >= words.length / 2 ? "🎉" : "💪"}</div>
        <div>
          <div className="text-3xl font-bold">
            {score}/{words.length}
          </div>
          <p className="text-sm text-muted-foreground">viết đúng</p>
        </div>
        <button
          onClick={onExit}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={onExit}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Thoát
        </button>
        <span className="text-muted-foreground">
          {currentIdx + 1}/{words.length} · {score} đúng
        </span>
      </div>

      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Nghe rồi gõ lại từ bạn nghe được
        </p>

        <div className="flex justify-center">
          <button
            onClick={() => speakWord(current)}
            className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
            aria-label="Nghe lại"
          >
            <Volume2 className="w-7 h-7" />
          </button>
        </div>

        {result && (
          <div
            className={`rounded-lg p-3 text-center text-sm ${
              result === "correct"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            }`}
          >
            {result === "correct" ? (
              <span className="inline-flex items-center gap-1">
                <Check className="w-4 h-4" /> Chính xác
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <X className="w-4 h-4" /> Đáp án: <strong>{current.word}</strong>
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={result !== null}
            placeholder="Gõ từ bạn nghe được…"
            autoFocus
            className="w-full px-4 py-3 rounded-lg border bg-transparent text-center text-lg outline-none focus:border-primary"
          />
          {!result ? (
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              Kiểm tra
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
            >
              {currentIdx + 1 >= words.length ? "Kết thúc" : "Từ tiếp theo"}
            </button>
          )}
        </form>

        {result === "wrong" && meaningOf(current) && (
          <p className="text-xs text-muted-foreground border-t pt-2">
            <span className="font-medium">Nghĩa:</span> {meaningOf(current)}
          </p>
        )}
      </div>
    </div>
  );
}
