"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Brain,
  Gamepad2,
  Volume2,
  Sparkles,
  TrendingUp,
  Library,
  Layers,
  Check,
  ArrowRight,
} from "lucide-react";

interface LandingPageProps {
  onStart: () => void;
}

const STATS = [
  { value: "10,000+", label: "từ vựng" },
  { value: "4", label: "bộ từ sẵn" },
  { value: "30", label: "bài đọc graded" },
  { value: "Free", label: "miễn phí" },
];

const FEATURES = [
  {
    icon: Layers,
    title: "Bộ từ vựng sẵn",
    desc: "TOEIC 600, Oxford 5000, 4000 Essential Words, Daily Conversations — chọn bộ phù hợp mục tiêu.",
  },
  {
    icon: BookOpen,
    title: "Flashcard thông minh",
    desc: "Học từ mới với IPA, audio, định nghĩa, ví dụ. Click để flip card, audio phát chuẩn bản xứ.",
  },
  {
    icon: Brain,
    title: "FSRS Spaced Repetition",
    desc: "Thuật toán FSRS state-of-the-art (cùng chuẩn Anki mới) — ôn đúng lúc bạn sắp quên, không dư không thiếu.",
  },
  {
    icon: Gamepad2,
    title: "Mini-Games",
    desc: "Match Words và Spelling Bee — học qua game, không buồn ngủ.",
  },
  {
    icon: Library,
    title: "Graded Reading Library",
    desc: "30 bài đọc sẵn A1-C2 từ daily life đến philosophy. 1-click import + auto-extract vocabulary.",
  },
  {
    icon: Volume2,
    title: "Dictionary + IPA + Audio",
    desc: "Free Dictionary API + CMU pronouncing dict — phát âm chuẩn, IPA đầy đủ, không cần Gemini.",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    desc: "Tier CEFR (A1→C2), mastery %, streak, per-level breakdown. Biết mình đang ở đâu.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Analysis",
    desc: "Paste bất kỳ văn bản nào — Gemini extract từ vựng + summarize. LanguageTool check grammar free.",
  },
];

const FAQS = [
  {
    q: "App này miễn phí không?",
    a: "Hoàn toàn miễn phí. Không cần đăng ký, không cần email, không giới hạn số từ học. Data lưu trong browser của bạn.",
  },
  {
    q: "App hỗ trợ những mục tiêu học nào?",
    a: "TOEIC (600 từ thiết yếu), Oxford 5000 (từ vựng chung), 4000 Essential Words (foundation), Giao tiếp hằng ngày (Shopping, Travel, Eating Out...). Tự tạo deck riêng cũng được.",
  },
  {
    q: "Spaced Repetition hoạt động thế nào?",
    a: "App dùng FSRS (Free Spaced Repetition Scheduler) — thuật toán mới nhất, cùng chuẩn với Anki 2024. Hệ thống đánh dấu từ cần ôn và đưa về đúng lúc bạn dễ quên nhất.",
  },
  {
    q: "Tôi có thể học trên điện thoại không?",
    a: "Có. Toàn bộ UI responsive, dùng tốt trên mobile, tablet, laptop. Không cần cài app — mở browser là dùng được.",
  },
  {
    q: "Khác biệt so với app khác là gì?",
    a: "Tất cả trong 1 chỗ: bộ từ sẵn + flashcard + game + SRS + reading library + grammar check + dictionary. Không cần nhảy qua lại nhiều app. Lại còn miễn phí.",
  },
  {
    q: "Data của tôi có an toàn không?",
    a: "Data lưu trong localStorage của browser bạn — không gửi đi đâu cả. Xóa browser data = xóa toàn bộ progress. Không có server thu thập.",
  },
];

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="w-3 h-3 mr-1" />
            FSRS · Gemini · Free Dictionary API
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Học từ vựng tiếng Anh
            <br />
            <span className="text-primary">có lộ trình, nhớ lâu</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Thay vì mở 5 app khác nhau, bạn chỉ cần một chỗ: chọn bộ từ, học flashcard,
            luyện qua game, để SRS nhắc ôn đúng lúc. 10,000+ từ vựng từ TOEIC, Oxford, IELTS.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button size="lg" onClick={onStart} className="gap-2">
              Bắt đầu học miễn phí
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-primary">{s.value}</div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Mọi thứ bạn cần để học từ vựng</h2>
          <p className="text-muted-foreground">
            8 tính năng cốt lõi, không cần app khác.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="border-border/50">
                <CardContent className="p-5 flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/30 border-y">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-center mb-12">Cách học trong 4 bước</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { num: "1", title: "Chọn bộ từ", desc: "Subscribe TOEIC, Oxford, Essential, hoặc Daily" },
              { num: "2", title: "Học Flashcard", desc: "Flip card, nghe audio, xem IPA + definition" },
              { num: "3", title: "Luyện qua Game", desc: "Match words + Spelling Bee để nhớ sâu" },
              { num: "4", title: "Ôn theo SRS", desc: "FSRS nhắc ôn đúng lúc — không quên, không dư" },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg mx-auto mb-3 flex items-center justify-center">
                  {step.num}
                </div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Câu hỏi thường gặp</h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <Card key={faq.q}>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-2 flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-1" />
                  {faq.q}
                </h3>
                <p className="text-sm text-muted-foreground ml-6">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl font-bold mb-3">Bắt đầu miễn phí, không cần cài app</h2>
          <p className="text-primary-foreground/80 mb-8">
            Mở browser là học được. Không đăng ký, không email, không giới hạn.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={onStart}
            className="gap-2"
          >
            Vào học ngay
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <div className="max-w-5xl mx-auto px-4">
          <p>
            Built with Next.js 16 · FSRS · Gemini 2.5 Flash · Free Dictionary API
          </p>
          <p className="mt-1 text-xs">
            Data sources: TOEIC 600 (tflat.vn) · Oxford 5000 (OUP) · 4000 Essential Words (Compass) · CEFR-J
          </p>
        </div>
      </footer>
    </div>
  );
}
