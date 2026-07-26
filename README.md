# Learn English — Reading + Quiz + Shadowing

Web app for English learners built with Next.js 16, Prisma + SQLite, NextAuth, and shadcn/ui.

## Features

- **Read**: Paste any English text. AI (mock) analyzes and highlights vocabulary by CEFR level. Click words to see definitions and save to your vocab notebook.
- **Quiz**: Generate mixed-format quizzes (mcq / cloze / recall) from saved texts. Each quiz updates the underlying memory model.
- **Review**: Spaced-repetition session built from items whose recall probability has dropped below threshold. Half-life regression with clamped bounds.
- **Vocab**: Searchable notebook of saved words. Each entry shows current recall probability and review history.
- **Progress**: Current CEFR tier, mastery score, streak, per-tier breakdown, and tier-advancement gate.
- **Shadow**: Web Speech API TTS plays the text; MediaRecorder captures your voice for side-by-side comparison.

## Architecture

- **Single-page app** with sidebar tabs (Read / Quiz / Review / Vocab / Progress / Shadow)
- **Server actions** for all Prisma DB writes (`src/lib/storage.ts` with `"use server"`)
- **API routes** for AI features (`/api/analyze`, `/api/quiz`) — currently mocked, swap to real AI later
- **NextAuth v4** with CredentialsProvider (demo) + GitHub OAuth (set env vars to enable)
- **Prisma + SQLite** for persistence (swap to Postgres for prod)

## Tech stack

- Next.js 16 (App Router, Turbopack)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui (New York)
- Prisma 6 + better-sqlite3
- NextAuth v4
- Zustand + TanStack Query (available, not yet used)
- Lucide icons, Sonner toasts, Framer Motion

## Local dev

```bash
bun install
bun run db:push     # sync Prisma schema to SQLite
bun run dev         # start dev server on port 3000
```

Open http://localhost:3000 and sign in with any email (demo mode).

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # Main shell: header + sidebar + tabs
│   ├── layout.tsx                # Root layout w/ SessionProvider + ThemeProvider
│   └── api/
│       ├── analyze/route.ts      # POST { text } → vocab + summary
│       ├── quiz/route.ts         # POST { textId, text, vocabList } → questions
│       └── auth/[...nextauth]/   # NextAuth handlers
├── components/
│   ├── providers.tsx             # Session + Theme providers
│   ├── ui/                       # shadcn/ui components
│   └── tabs/
│       ├── read-tab.tsx
│       ├── quiz-tab.tsx
│       ├── review-tab.tsx
│       ├── vocab-tab.tsx
│       ├── progress-tab.tsx
│       └── shadow-tab.tsx
└── lib/
    ├── types.ts                  # Domain DTOs
    ├── auth.ts                   # NextAuth config
    ├── storage.ts                # Prisma helpers (server actions)
    ├── ai-client.ts              # Mock AI for analyze + quiz
    ├── mastery-engine.ts         # Half-life regression + recall estimation
    ├── session-builder.ts        # Due-item picker + interleaver
    ├── content-curation.ts       # Word relevance ranking
    ├── mastery-gate.ts           # Tier advancement logic
    └── db.ts                     # Prisma client singleton
```

## Mastery engine

Each `MemoryItem` has a `halfLifeDays` value. Recall probability is estimated as:

```
p = exp(-daysSinceReview / halfLifeDays)
```

After each review:
- **Correct + fast (<3s)**: halfLife × 2.6
- **Correct + normal**: halfLife × 2.0
- **Correct + slow (>10s)**: halfLife × 1.6
- **Wrong**: halfLife × 0.4

Half-life is clamped to `[0.25, 365]` days to prevent runaway states (a known blind-spot of naive half-life regression).

## Deploy

1. Push repo to GitHub
2. Connect repo to Vercel
3. Set env vars:
   - `DATABASE_URL` — Vercel Postgres or Turso SQLite URL
   - `NEXTAUTH_SECRET` — random secret
   - `NEXTAUTH_URL` — production URL
   - `GITHUB_ID` + `GITHUB_SECRET` (optional, for GitHub OAuth)
4. Vercel auto-builds on every push

## Roadmap (not in MVP)

- Real AI integration (swap mock `ai-client.ts` with `z-ai-web-dev-sdk` or Claude)
- CEFR dataset bundle (Cambridge English Profile Wordlist, ~6k words)
- Speech-to-text scoring for shadowing (compare user recording vs source)
- Multi-device sync (already on Prisma, just need real auth)
- Adaptive difficulty (skip easy items, surface weak spots)
