import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Learn English — Reading + Shadowing",
  description:
    "Read real texts, learn vocabulary in context, master with spaced repetition, and shadow speaking with TTS.",
  keywords: [
    "English learning",
    "reading comprehension",
    "shadowing",
    "spaced repetition",
    "CEFR",
    "vocabulary",
  ],
  authors: [{ name: "Learn English App" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
