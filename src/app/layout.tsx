import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Learn English — Đọc hiểu và luyện nói",
  description:
    "Đọc văn bản thật, học từ vựng theo ngữ cảnh, ghi nhớ bằng ôn tập ngắt quãng FSRS và luyện nói theo kiểu shadowing.",
  keywords: [
    "học tiếng Anh",
    "luyện đọc hiểu",
    "luyện nói shadowing",
    "ôn tập ngắt quãng",
    "FSRS",
    "CEFR",
    "từ vựng tiếng Anh",
    "English learning",
  ],
  authors: [{ name: "Learn English" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Giao diện là tiếng Việt. Để lang="en" thì trình đọc màn hình phát âm
    // toàn bộ nội dung bằng giọng Anh, nghe không ra chữ gì.
    <html lang="vi" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <Providers>
          {children}
          <Toaster />
          <SonnerToaster />
        </Providers>
      </body>
    </html>
  );
}
