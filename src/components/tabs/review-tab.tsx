"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Brain, CheckCircle2, RotateCcw, Play } from "lucide-react";
import { PronounceButton } from "@/components/pronounce-button";
import type { MemoryItemDTO, VocabItemDTO, QuizType } from "@/lib/types";
import { getMemoryItems, getVocabItems, reviewMemoryItem } from "@/lib/storage";
import { buildReviewSession, type ReviewSessionItem } from "@/lib/session-builder";
import {
  previewSchedule,
  formatInterval,
  fromCardState,
  type ReviewRating,
} from "@/lib/fsrs";
import { Rating } from "ts-fsrs";
import { award } from "@/lib/gamification";
import { getReviewComment } from "@/lib/humor";

interface ReviewTabProps {
  userId: string;
}

/** Khoá tra lịch xem trước — phải khớp tên trường `previewSchedule` trả về. */
type KhoaMuc = "again" | "hard" | "good" | "easy";

const RATING_BUTTONS: Array<{
  rating: ReviewRating;
  /** Khoá kỹ thuật, không hiển thị. Tách khỏi nhãn để đổi chữ không làm vỡ tra cứu. */
  khoa: KhoaMuc;
  label: string;
  color: string;
  phim: string;
}> = [
  // Giá trị enum thật: Again=1, Hard=2, Good=3, Easy=4. Bản cũ gõ số trần
  // 2/3/4/5 theo một comment sai, khiến MỌI nút gửi đi mức cao hơn một bậc
  // và nút "Easy" gửi 5 — nằm ngoài dải hợp lệ.
  {
    rating: Rating.Again,
    khoa: "again",
    label: "Quên rồi",
    color: "bg-red-500 hover:bg-red-600 text-white",
    phim: "1",
  },
  {
    rating: Rating.Hard,
    khoa: "hard",
    label: "Khó nhớ",
    color: "bg-orange-500 hover:bg-orange-600 text-white",
    phim: "2",
  },
  {
    rating: Rating.Good,
    khoa: "good",
    label: "Nhớ được",
    color: "bg-green-600 hover:bg-green-700 text-white",
    phim: "3",
  },
  {
    rating: Rating.Easy,
    khoa: "easy",
    label: "Quá dễ",
    color: "bg-blue-500 hover:bg-blue-600 text-white",
    phim: "4",
  },
];

const TEN_DANG: Record<QuizType, string> = {
  mcq: "Chọn nghĩa",
  cloze: "Điền từ",
  recall: "Nhớ lại",
};

/**
 * Khoét từ khỏi câu ví dụ để làm bài điền từ.
 *
 * Không dùng `new RegExp(word)`: từ vựng có thể chứa ký tự regex — dấu ngoặc
 * trong "(to) run", dấu chấm trong "e.g." — và khi đó regex hoặc ném lỗi hoặc
 * khớp nhầm chỗ. So chuỗi thường là đủ và không bao giờ hỏng.
 */
export function taoCauDienTu(cau: string, tu: string): string {
  const i = cau.toLowerCase().indexOf(tu.toLowerCase());
  if (i === -1) return cau;
  return cau.slice(0, i) + "_____" + cau.slice(i + tu.length);
}

export function ReviewTab({ userId }: ReviewTabProps) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ReviewSessionItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState<{ reviewed: number; again: number }>({
    reviewed: 0,
    again: 0,
  });
  const [vocabs, setVocabs] = useState<VocabItemDTO[]>([]);

  async function loadSession() {
    setLoading(true);
    const [memItems, vocabItems] = await Promise.all([
      getMemoryItems(userId),
      getVocabItems(userId),
    ]);
    setVocabs(vocabItems);
    const sess = buildReviewSession(memItems, 18);
    setSession(sess);
    setCurrentIdx(0);
    setAnswer("");
    setShowAnswer(false);
    setCompleted(false);
    setResults({ reviewed: 0, again: 0 });
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [memItems, vocabItems] = await Promise.all([
        getMemoryItems(userId),
        getVocabItems(userId),
      ]);
      if (cancelled) return;
      setVocabs(vocabItems);
      const sess = buildReviewSession(memItems, 18);
      setSession(sess);
      setCurrentIdx(0);
      setAnswer("");
      setShowAnswer(false);
      setCompleted(false);
      setResults({ reviewed: 0, again: 0 });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function getVocabForItem(item: MemoryItemDTO): VocabItemDTO | undefined {
    return vocabs.find((v) => v.memoryItemId === item.id);
  }

  function renderQuestion(item: ReviewSessionItem) {
    const v = getVocabForItem(item.item);
    if (!v) {
      return (
        <p className="text-sm text-muted-foreground">
          Thẻ này không còn từ vựng đi kèm — có thể từ đã bị xoá.
        </p>
      );
    }

    const format: QuizType = item.chosenFormat;

    if (format === "mcq") {
      const distractors = vocabs
        .filter((x) => x.id !== v?.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((x) => x.definition);
      const options = [v.definition, ...distractors].sort(() => Math.random() - 0.5);
      return (
        <div className="space-y-3">
          <p className="text-sm">
            <strong className="text-primary">{v.word}</strong> nghĩa là gì?
          </p>
          {v.ipa && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{v.ipa}</span>
              <PronounceButton word={v.word} audioUrl={v.audioUrl} />
            </div>
          )}
          <div className="text-xs text-muted-foreground border-l-2 pl-2 italic mb-2">
            &ldquo;{v.contextSentence}&rdquo;
          </div>
          {showAnswer ? (
            <div className="bg-emerald-50 dark:bg-emerald-950 p-3 rounded-md text-sm">
              <strong>Đáp án:</strong> {v.definition}
            </div>
          ) : (
            <div className="space-y-2">
              {options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setAnswer(opt)}
                  className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                    answer === opt ? "border-primary bg-primary/5" : "hover:bg-accent"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (format === "cloze") {
      const clozeSentence = taoCauDienTu(v.contextSentence, v.word);
      return (
        <div className="space-y-3">
          <p className="text-sm">Điền từ còn thiếu:</p>
          <div className="border-l-2 pl-3 py-1 italic">{clozeSentence}</div>
          {showAnswer ? (
            <div className="bg-emerald-50 dark:bg-emerald-950 p-3 rounded-md text-sm">
              <strong>Đáp án:</strong> {v.word}
              {v.ipa && <span className="ml-2 font-mono text-xs">{v.ipa}</span>}
            </div>
          ) : (
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Gõ từ còn thiếu…"
              aria-label="Từ còn thiếu"
              onKeyDown={(e) => {
                if (e.key === "Enter") setShowAnswer(true);
              }}
            />
          )}
        </div>
      );
    }

    // recall
    return (
      <div className="space-y-3">
        <p className="text-sm">Từ nào mang nghĩa này?</p>
        <div className="bg-accent p-3 rounded-md text-sm">{v.definition}</div>
        {showAnswer ? (
          <div className="bg-emerald-50 dark:bg-emerald-950 p-3 rounded-md text-sm">
            <strong>Đáp án:</strong> {v.word}
            {v.ipa && <span className="ml-2 font-mono text-xs">{v.ipa}</span>}
            <PronounceButton
              word={v.word}
              audioUrl={v.audioUrl}
              className="ml-2 align-middle"
            />
          </div>
        ) : (
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Gõ từ bạn nghĩ tới…"
            aria-label="Từ bạn nghĩ tới"
            onKeyDown={(e) => {
              if (e.key === "Enter") setShowAnswer(true);
            }}
          />
        )}
      </div>
    );
  }

  async function handleReview(rating: ReviewRating) {
    if (!session[currentIdx]) return;
    const item = session[currentIdx];

    await reviewMemoryItem(userId, item.item.id, rating);

    setResults((prev) => ({
      reviewed: prev.reviewed + 1,
      again: prev.again + (rating === Rating.Again ? 1 : 0),
    }));

    const correct = rating !== Rating.Again;
    const { newAchievements } = award("review-word");
    toast.success(getReviewComment(correct), { duration: 2500 });
    newAchievements.forEach((a) => {
      toast.success(`🏅 ${a.name}: ${a.description}`, { duration: 5000 });
    });

    if (rating === Rating.Again) {
      toast.info("Sẽ ôn lại sớm", { duration: 2000 });
    }

    if (currentIdx + 1 >= session.length) {
      setCompleted(true);
      toast.success("Xong buổi ôn rồi!");
      return;
    }
    setCurrentIdx((i) => i + 1);
    setAnswer("");
    setShowAnswer(false);
  }

  /**
   * Phím tắt 1–4 để chấm, Space hoặc Enter để lật đáp án.
   *
   * Bản trước in dòng "Press 1-4 to select" nhưng không gắn listener nào, nên
   * bấm số chẳng có gì xảy ra. Cố ý không khai mảng dependency: handler phải
   * luôn thấy `showAnswer` và `currentIdx` mới nhất, và gắn lại listener mỗi
   * lần render rẻ hơn nhiều so với một bug closure cũ.
   */
  useEffect(() => {
    function xuLyPhim(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (loading || completed || session.length === 0) return;

      if (!showAnswer) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setShowAnswer(true);
        }
        return;
      }

      const nut = RATING_BUTTONS.find((b) => b.phim === e.key);
      if (nut) {
        e.preventDefault();
        void handleReview(nut.rating);
      }
    }
    window.addEventListener("keydown", xuLyPhim);
    return () => window.removeEventListener("keydown", xuLyPhim);
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (session.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <Brain className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Chưa có thẻ nào tới hạn ôn.</p>
          <p className="text-xs text-muted-foreground">
            Lưu từ ở tab Đọc hoặc đăng ký một bộ từ, rồi quay lại khi thẻ tới hạn.
          </p>
          <Button onClick={loadSession} variant="outline">
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Kiểm tra lại
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (completed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Xong buổi ôn
          </CardTitle>
          <CardDescription>Bạn vừa ôn {results.reviewed} thẻ.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <div className="text-3xl font-bold">{results.reviewed}</div>
            <p className="text-sm text-muted-foreground mt-1">thẻ đã ôn</p>
            {results.again > 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                {results.again} thẻ đánh dấu &ldquo;Quên rồi&rdquo; — sẽ hiện lại sớm
              </p>
            )}
          </div>
          <Button onClick={loadSession} className="w-full">
            <Play className="w-4 h-4 mr-1.5" />
            Ôn tiếp buổi mới
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentItem = session[currentIdx];
  const progress = (currentIdx / session.length) * 100;
  const preview = previewSchedule(fromCardState(currentItem.item.card));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              Thẻ {currentIdx + 1} / {session.length}
            </span>
            <Badge variant="outline">{TEN_DANG[currentItem.chosenFormat]}</Badge>
          </div>
          <Progress
            value={progress}
            className="h-2"
            aria-label={`Đã ôn ${currentIdx} trên ${session.length} thẻ`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Ôn tập
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderQuestion(currentItem)}

          {!showAnswer ? (
            <Button onClick={() => setShowAnswer(true)} className="w-full mt-4" size="lg">
              Xem đáp án
            </Button>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-center text-muted-foreground mb-2">
                Bạn nhớ được tới đâu?
              </p>
              <div className="grid grid-cols-4 gap-2">
                {RATING_BUTTONS.map((btn) => (
                  <button
                    key={btn.rating}
                    onClick={() => handleReview(btn.rating)}
                    className={`px-3 py-3 rounded-md text-sm font-medium transition-colors ${btn.color}`}
                  >
                    <div>{btn.label}</div>
                    <div className="text-xs opacity-80 mt-0.5">
                      {formatInterval(preview[btn.khoa].intervalDays)}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Bấm phím 1–4 để chấm nhanh, hoặc chọn nút ở trên
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
