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
  Mic,
  RefreshCw,
  Check,
  ArrowRight,
} from "lucide-react";

interface LandingPageProps {
  onStart: () => void;
}

const STATS = [
  { value: "10,000+", label: "từ vựng" },
  { value: "4", label: "bộ từ sẵn" },
  { value: "30", label: "bài đọc theo trình độ" },
  { value: "0đ", label: "trọn bộ tính năng" },
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
    desc: "Học từ mới kèm IPA, phát âm, định nghĩa và ví dụ. Chạm để lật thẻ, nghe giọng bản xứ.",
  },
  {
    icon: Brain,
    title: "Ôn tập ngắt quãng FSRS",
    desc: "Thuật toán FSRS mới nhất, cùng chuẩn với Anki 2024 — nhắc ôn đúng lúc bạn sắp quên, không dư không thiếu.",
  },
  {
    icon: Gamepad2,
    title: "Bảy trò ôn từ",
    desc: "Đấu trùm từ vựng, tốc chiến 60 giây, nối từ, lật thẻ trí nhớ, xếp chữ, đúng hay sai, nghe viết chính tả.",
  },
  {
    icon: Library,
    title: "Thư viện bài đọc theo trình độ",
    desc: "30 bài sẵn từ A1 đến C2, từ chuyện thường ngày tới triết học. Nhập một chạm, tự tách từ vựng ra sổ.",
  },
  {
    icon: Volume2,
    title: "Từ điển, IPA và phát âm",
    desc: "Free Dictionary API cùng bộ phiên âm CMU — nghe phát âm chuẩn, IPA đầy đủ, không cần tới AI.",
  },
  {
    icon: Mic,
    title: "Luyện nói shadowing",
    desc: "Nghe câu mẫu, nhại lại, tự ghi âm rồi nghe lại để so. Luyện phát âm mà không phải đoán mò xem mình nói có giống không.",
  },
  {
    icon: TrendingUp,
    title: "Theo dõi tiến độ",
    desc: "Bậc CEFR từ A1 tới C2, mức thành thạo, chuỗi ngày học, thống kê theo từng bậc. Biết mình đang ở đâu.",
  },
  {
    icon: Sparkles,
    title: "Phân tích bằng AI",
    desc: "Dán bất kỳ văn bản nào — Gemini tách từ vựng và tóm tắt. LanguageTool kiểm tra ngữ pháp, miễn phí.",
  },
  {
    icon: RefreshCw,
    title: "Tài khoản và đồng bộ",
    desc: "Học trên máy tính, ôn tiếp trên điện thoại. Đăng nhập rồi thì tiến độ đi theo bạn, không mất khi xoá trình duyệt.",
  },
];

const FAQS = [
  {
    q: "App này miễn phí không?",
    a: "Hoàn toàn miễn phí, không giới hạn số từ học. Dùng ngay được mà không cần đăng ký; muốn giữ tiến độ trên nhiều thiết bị thì tạo tài khoản, cũng miễn phí.",
  },
  {
    q: "App hỗ trợ những mục tiêu học nào?",
    a: "TOEIC (600 từ thiết yếu), Oxford 5000 (từ vựng phổ thông), 4000 Essential Words (nền tảng), Giao tiếp hằng ngày (mua sắm, du lịch, ăn uống…). Tự tạo bộ từ riêng cũng được.",
  },
  {
    q: "Ôn tập ngắt quãng hoạt động thế nào?",
    a: "App dùng FSRS (Free Spaced Repetition Scheduler) — thuật toán mới nhất, cùng chuẩn với Anki 2024. Hệ thống đánh dấu từ cần ôn và đưa về đúng lúc bạn dễ quên nhất.",
  },
  {
    q: "Tôi có thể học trên điện thoại không?",
    a: "Có. Toàn bộ giao diện co giãn theo màn hình, chạy tốt trên điện thoại, máy tính bảng và laptop. Không cần cài gì — mở trình duyệt là học được.",
  },
  {
    q: "Khác biệt so với app khác là gì?",
    a: "Tất cả trong một chỗ: bộ từ sẵn, flashcard, game, ôn tập ngắt quãng, thư viện bài đọc, kiểm tra ngữ pháp, từ điển và luyện nói. Không phải nhảy qua lại nhiều app. Lại còn miễn phí.",
  },
  {
    q: "Dữ liệu của tôi nằm ở đâu?",
    a: "Chưa đăng nhập thì mọi thứ nằm trong trình duyệt của bạn, không gửi đi đâu — đổi lại, xoá dữ liệu trình duyệt là mất sạch tiến độ. Đăng nhập thì tiến độ được lưu trên máy chủ của app để đồng bộ giữa các thiết bị, và không chia sẻ cho bên thứ ba nào.",
  },
  {
    q: "Có chế độ tối không?",
    a: "Có. Mở menu tài khoản ở góc trên rồi chọn Sáng, Tối hoặc Theo hệ thống.",
  },
];

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-background bg-mesh">
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-fuchsia-500/10" />
        {/* Hai quầng sáng mờ: hero phẳng thì phần còn lại của trang có đẹp
            cũng không cứu được ấn tượng đầu. */}
        <div className="absolute -top-28 -left-24 w-[28rem] h-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -top-20 -right-24 w-[26rem] h-[26rem] rounded-full bg-fuchsia-500/12 blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="w-3 h-3 mr-1" />
            FSRS · Gemini · Free Dictionary API
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Học từ vựng tiếng Anh
            <br />
            <span className="text-brand">có lộ trình, nhớ lâu</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Thay vì mở 5 app khác nhau, bạn chỉ cần một chỗ: chọn bộ từ, học flashcard,
            luyện qua game, để hệ thống nhắc ôn đúng lúc. Hơn 10.000 từ từ TOEIC, Oxford và
            4000 Essential Words.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button size="lg" onClick={onStart} className="gap-2 text-base px-7">
              Bắt đầu học miễn phí
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="text-3xl sm:text-4xl font-bold text-brand">{s.value}</div>
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
            9 tính năng cốt lõi, không cần app khác.
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
              { num: "1", title: "Chọn bộ từ", desc: "Thêm bộ TOEIC, Oxford, Essential hoặc Giao tiếp" },
              { num: "2", title: "Học flashcard", desc: "Lật thẻ, nghe phát âm, xem IPA và nghĩa" },
              { num: "3", title: "Luyện qua game", desc: "Nối từ, xếp chữ, đúng hay sai — nhớ sâu hơn học chay" },
              { num: "4", title: "Ôn lại đúng lúc", desc: "FSRS nhắc đúng hôm bạn sắp quên, không dư không thiếu" },
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
      <section className="relative overflow-hidden border-t bg-brand text-white">
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[34rem] h-[34rem] rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-3xl mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl font-bold mb-3">Bắt đầu miễn phí, không cần cài app</h2>
          <p className="text-white/80 mb-8">
            Mở trình duyệt là học được. Muốn đồng bộ nhiều thiết bị thì đăng nhập, còn
            không thì cứ học thẳng.
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
            Dựng bằng Next.js 16 · FSRS · Gemini 2.5 Flash · Free Dictionary API
          </p>
          <p className="mt-1 text-xs">
            Nguồn dữ liệu: TOEIC 600 (tflat.vn) · Oxford 5000 (OUP) · 4000 Essential Words (Compass) · CEFR-J
          </p>
        </div>
      </footer>
    </div>
  );
}
