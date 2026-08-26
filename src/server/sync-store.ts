/**
 * Đầu mối đồng bộ: GET để kéo về, POST để đẩy lên.
 *
 * ## Quy tắc bất di bất dịch
 *
 * `userId` **luôn** lấy từ session. Payload có gửi kèm id nào cũng bị bỏ. Đây
 * là ranh giới duy nhất giữa dữ liệu của người này và người khác.
 *
 * ## Vì sao POST vẫn so `updatedAt` dù client đã hợp nhất rồi
 *
 * Client kéo về rồi mới đẩy lên, nên bản nó gửi lẽ ra đã bao trùm bản server.
 * "Lẽ ra" là chỗ hỏng: một thiết bị khác có thể ghi vào đúng khe giữa lần GET
 * và lần POST đó. So lại ở server biến chuyện này thành vô hại — bản cũ hơn bị
 * bỏ qua thay vì đè mất bản mới.
 *
 * ## Xử lý khoá ngoại
 *
 * `MemoryItem`, `VocabItem`, `QuizQuestion`, `ShadowSession` đều trỏ tới
 * `Text`. Bản ghi nào trỏ tới một bài đọc không tồn tại (đã bị xoá ở nơi khác)
 * sẽ bị loại thay vì làm hỏng cả lượt đồng bộ.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import type { SyncPayload } from "@/server/sync-schema";
import type { CEFRLevel, FSRSCardState, ItemType, QuizType } from "@/lib/types";

// ==========================================================================
// Chuyển đổi giữa DTO của client và hàng trong database
// ==========================================================================

interface FsrsColumns {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
}

function cardToColumns(card: FSRSCardState): FsrsColumns {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ? new Date(card.last_review) : null,
  };
}

function columnsToCard(row: FsrsColumns): FSRSCardState {
  return {
    due: row.due.toISOString(),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.lastReview ? row.lastReview.toISOString() : null,
  };
}

// ==========================================================================
// GET — kéo toàn bộ dữ liệu của người dùng
// ==========================================================================

export async function readSnapshot(prisma: PrismaClient, userId: string) {
  const [
    texts,
    memoryItems,
    vocabItems,
    quizQuestions,
    shadowSessions,
    userProgress,
    pathProgress,
    gamification,
    deckSubscriptions,
  ] = await Promise.all([
    prisma.text.findMany({ where: { userId } }),
    prisma.memoryItem.findMany({ where: { userId } }),
    prisma.vocabItem.findMany({ where: { userId } }),
    prisma.quizQuestion.findMany({ where: { userId } }),
    prisma.shadowSession.findMany({ where: { userId } }),
    prisma.userProgress.findUnique({ where: { userId } }),
    prisma.pathProgress.findUnique({ where: { userId } }),
    prisma.gamificationState.findUnique({ where: { userId } }),
    prisma.deckSubscription.findMany({
      where: { userId },
      include: { cardStates: true },
    }),
  ]);

  return {
    texts: texts.map((t) => ({
      id: t.id,
      userId: t.userId,
      title: t.title,
      content: t.content,
      cefrLevel: t.cefrLevel as CEFRLevel,
      summary: t.summary,
      readability: t.readability as
        | { fleschKincaid: number; fleschReading: number; cefrEstimate: CEFRLevel; wordCount: number }
        | null,
      createdAt: t.createdAt.getTime(),
      updatedAt: t.updatedAt.getTime(),
    })),
    memoryItems: memoryItems.map((m) => ({
      id: m.id,
      userId: m.userId,
      sourceTextId: m.sourceTextId,
      itemType: m.itemType as ItemType,
      refText: m.refText,
      cefrLevel: m.cefrLevel as CEFRLevel,
      card: columnsToCard(m),
      createdAt: m.createdAt.getTime(),
      updatedAt: m.updatedAt.getTime(),
    })),
    vocabItems: vocabItems.map((v) => ({
      id: v.id,
      userId: v.userId,
      word: v.word,
      definition: v.definition,
      vietnamese: v.vietnamese,
      exampleSentence: v.exampleSentence,
      exampleVietnamese: v.exampleVietnamese,
      contextSentence: v.contextSentence,
      cefrLevel: v.cefrLevel as CEFRLevel,
      ipa: v.ipa,
      audioUrl: v.audioUrl,
      sourceTextId: v.sourceTextId,
      memoryItemId: v.memoryItemId,
      createdAt: v.createdAt.getTime(),
      updatedAt: v.updatedAt.getTime(),
    })),
    quizQuestions: quizQuestions.map((q) => ({
      id: q.id,
      userId: q.userId,
      textId: q.textId,
      type: q.type as QuizType,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      relatedMemoryItemId: q.relatedMemoryItemId,
      createdAt: q.createdAt.getTime(),
    })),
    shadowSessions: shadowSessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      textId: s.textId,
      audioUrl: s.audioUrl,
      userRecordingUrl: s.userRecordingUrl,
      completedAt: s.completedAt.getTime(),
    })),
    userProgress: userProgress
      ? {
          id: userProgress.id,
          userId: userProgress.userId,
          currentTier: userProgress.currentTier as CEFRLevel,
          tierMasteryScore: userProgress.tierMasteryScore,
          streakDays: userProgress.streakDays,
          lastActiveDate: userProgress.lastActiveDate.getTime(),
          updatedAt: userProgress.updatedAt.getTime(),
        }
      : null,
    pathProgress: pathProgress
      ? {
          completedLessons: pathProgress.completedLessons,
          lessonScores: (pathProgress.lessonScores ?? {}) as Record<string, number>,
          learnedWords: pathProgress.learnedWords,
          lastStudiedAt: pathProgress.lastStudiedAt
            ? pathProgress.lastStudiedAt.toISOString()
            : null,
          updatedAt: pathProgress.updatedAt.getTime(),
        }
      : null,
    gamification: gamification
      ? {
          coins: gamification.coins,
          xp: gamification.xp,
          level: gamification.level,
          streak: gamification.streak,
          lastStudyDate: gamification.lastStudyDate,
          todayProgress: {
            date: gamification.progressDate,
            wordsLearned: gamification.wordsLearned,
            wordsReviewed: gamification.wordsReviewed,
            gamesPlayed: gamification.gamesPlayed,
          },
          achievements: gamification.achievements,
          updatedAt: gamification.updatedAt.getTime(),
        }
      : null,
    deckSubscriptions: deckSubscriptions.map((d) => ({
      deckId: d.deckId,
      subscribedAt: d.subscribedAt.getTime(),
      studiedWords: d.studiedWords,
      cardStates: Object.fromEntries(
        d.cardStates.map((c) => [c.word, columnsToCard(c)])
      ),
      updatedAt: d.updatedAt.getTime(),
    })),
    // Bia mộ chỉ đi một chiều từ client lên. Server đã xoá hàng rồi thì không
    // còn gì để báo lại — deck vắng mặt trong danh sách trên đã là câu trả lời.
    deckTombstones: {} as Record<string, number>,
  };
}


// ==========================================================================
// POST — nhận dữ liệu client đẩy lên
// ==========================================================================

/** `updatedAt` hiện có trên server, theo id. Thiếu nghĩa là chưa từng có. */
type StampMap = Map<string, number>;

function isNewer(stamps: StampMap, id: string, incoming: number): boolean {
  const existing = stamps.get(id);
  return existing === undefined || incoming >= existing;
}

export async function writeSnapshot(
  prisma: PrismaClient,
  userId: string,
  payload: SyncPayload
): Promise<void> {
  // --- Đọc trước những mốc thời gian cần để so ---
  const [
    existingTexts,
    existingMemory,
    existingVocab,
    existingQuizIds,
    existingShadowIds,
    existingProgress,
    existingPath,
    existingGam,
    existingDecks,
  ] = await Promise.all([
    prisma.text.findMany({ where: { userId }, select: { id: true, updatedAt: true } }),
    prisma.memoryItem.findMany({ where: { userId }, select: { id: true, updatedAt: true } }),
    prisma.vocabItem.findMany({ where: { userId }, select: { id: true, updatedAt: true } }),
    prisma.quizQuestion.findMany({ where: { userId }, select: { id: true } }),
    prisma.shadowSession.findMany({ where: { userId }, select: { id: true } }),
    prisma.userProgress.findUnique({ where: { userId }, select: { updatedAt: true } }),
    prisma.pathProgress.findUnique({ where: { userId }, select: { updatedAt: true } }),
    prisma.gamificationState.findUnique({ where: { userId }, select: { updatedAt: true } }),
    prisma.deckSubscription.findMany({
      where: { userId },
      select: { id: true, deckId: true, updatedAt: true },
    }),
  ]);

  const textStamps: StampMap = new Map(existingTexts.map((t) => [t.id, t.updatedAt.getTime()]));
  const memoryStamps: StampMap = new Map(existingMemory.map((m) => [m.id, m.updatedAt.getTime()]));
  const vocabStamps: StampMap = new Map(existingVocab.map((v) => [v.id, v.updatedAt.getTime()]));
  const quizIds = new Set(existingQuizIds.map((q) => q.id));
  const shadowIds = new Set(existingShadowIds.map((s) => s.id));
  const deckStamps: StampMap = new Map(existingDecks.map((d) => [d.deckId, d.updatedAt.getTime()]));

  // --- Bài đọc: nền của mọi khoá ngoại, phải ghi trước ---
  const textWrites = payload.texts
    .filter((t) => isNewer(textStamps, t.id, t.updatedAt))
    .map((t) => {
      const data = {
        title: t.title,
        content: t.content,
        cefrLevel: t.cefrLevel,
        summary: t.summary ?? null,
        readability: (t.readability ?? null) as Prisma.InputJsonValue,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      };
      return prisma.text.upsert({
        where: { id: t.id },
        create: { id: t.id, userId, ...data },
        update: data,
      });
    });

  if (textWrites.length > 0) {
    await prisma.$transaction(textWrites, { timeout: 30000 });
  }

  // Bài đọc nào thật sự tồn tại sau bước trên — dùng để lọc khoá ngoại.
  const liveTextIds = new Set([
    ...textStamps.keys(),
    ...payload.texts.map((t) => t.id),
  ]);

  // --- Thẻ ôn tập ---
  const memoryWrites = payload.memoryItems
    .filter((m) => liveTextIds.has(m.sourceTextId))
    .filter((m) => isNewer(memoryStamps, m.id, m.updatedAt))
    .map((m) => {
      const data = {
        sourceTextId: m.sourceTextId,
        itemType: m.itemType,
        refText: m.refText,
        cefrLevel: m.cefrLevel,
        ...cardToColumns(m.card),
        createdAt: new Date(m.createdAt),
        updatedAt: new Date(m.updatedAt),
      };
      return prisma.memoryItem.upsert({
        where: { id: m.id },
        create: { id: m.id, userId, ...data },
        update: data,
      });
    });

  if (memoryWrites.length > 0) {
    await prisma.$transaction(memoryWrites, { timeout: 30000 });
  }

  const liveMemoryIds = new Set([
    ...memoryStamps.keys(),
    ...payload.memoryItems.map((m) => m.id),
  ]);

  // --- Từ vựng (trỏ tới cả Text lẫn MemoryItem) ---
  const vocabWrites = payload.vocabItems
    .filter((v) => liveTextIds.has(v.sourceTextId) && liveMemoryIds.has(v.memoryItemId))
    .filter((v) => isNewer(vocabStamps, v.id, v.updatedAt))
    .map((v) => {
      const data = {
        word: v.word,
        definition: v.definition,
        vietnamese: v.vietnamese ?? null,
        exampleSentence: v.exampleSentence,
        exampleVietnamese: v.exampleVietnamese ?? null,
        contextSentence: v.contextSentence,
        cefrLevel: v.cefrLevel,
        ipa: v.ipa ?? null,
        audioUrl: v.audioUrl ?? null,
        sourceTextId: v.sourceTextId,
        memoryItemId: v.memoryItemId,
        createdAt: new Date(v.createdAt),
        updatedAt: new Date(v.updatedAt),
      };
      return prisma.vocabItem.upsert({
        where: { id: v.id },
        create: { id: v.id, userId, ...data },
        update: data,
      });
    });

  // --- Câu hỏi quiz và phiên luyện nói: chỉ tạo, không bao giờ sửa ---
  const quizWrites = payload.quizQuestions
    .filter((q) => liveTextIds.has(q.textId) && !quizIds.has(q.id))
    .map((q) =>
      prisma.quizQuestion.create({
        data: {
          id: q.id,
          userId,
          textId: q.textId,
          type: q.type,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          relatedMemoryItemId: q.relatedMemoryItemId ?? null,
          createdAt: new Date(q.createdAt),
        },
      })
    );

  const shadowWrites = payload.shadowSessions
    .filter((s) => liveTextIds.has(s.textId) && !shadowIds.has(s.id))
    .map((s) =>
      prisma.shadowSession.create({
        data: {
          id: s.id,
          userId,
          textId: s.textId,
          audioUrl: s.audioUrl,
          userRecordingUrl: s.userRecordingUrl,
          completedAt: new Date(s.completedAt),
        },
      })
    );

  // --- Ba bản ghi đơn lẻ ---
  const singletonWrites: Prisma.PrismaPromise<unknown>[] = [];

  const progress = payload.userProgress;
  if (
    progress &&
    (!existingProgress || progress.updatedAt >= existingProgress.updatedAt.getTime())
  ) {
    const data = {
      currentTier: progress.currentTier,
      tierMasteryScore: progress.tierMasteryScore,
      streakDays: progress.streakDays,
      lastActiveDate: new Date(progress.lastActiveDate),
      updatedAt: new Date(progress.updatedAt),
    };
    singletonWrites.push(
      prisma.userProgress.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      })
    );
  }

  const path = payload.pathProgress;
  if (path && (!existingPath || path.updatedAt >= existingPath.updatedAt.getTime())) {
    const data = {
      completedLessons: path.completedLessons,
      lessonScores: path.lessonScores as Prisma.InputJsonValue,
      learnedWords: path.learnedWords,
      lastStudiedAt: path.lastStudiedAt ? new Date(path.lastStudiedAt) : null,
      updatedAt: new Date(path.updatedAt),
    };
    singletonWrites.push(
      prisma.pathProgress.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      })
    );
  }

  const gam = payload.gamification;
  if (gam && (!existingGam || gam.updatedAt >= existingGam.updatedAt.getTime())) {
    const data = {
      coins: gam.coins,
      xp: gam.xp,
      level: gam.level,
      streak: gam.streak,
      lastStudyDate: gam.lastStudyDate,
      progressDate: gam.todayProgress.date,
      wordsLearned: gam.todayProgress.wordsLearned,
      wordsReviewed: gam.todayProgress.wordsReviewed,
      gamesPlayed: gam.todayProgress.gamesPlayed,
      achievements: gam.achievements,
      updatedAt: new Date(gam.updatedAt),
    };
    singletonWrites.push(
      prisma.gamificationState.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      })
    );
  }

  // --- Huỷ đăng ký deck: xoá trước khi ghi, để đăng ký lại vẫn thắng ---
  const doomedDeckIds = Object.entries(payload.deckTombstones)
    .filter(([deckId, deletedAt]) => {
      const stamp = deckStamps.get(deckId);
      if (stamp === undefined) return false;
      const stillSubscribed = payload.deckSubscriptions.some(
        (s) => s.deckId === deckId && s.updatedAt > deletedAt
      );
      return !stillSubscribed && deletedAt >= stamp;
    })
    .map(([deckId]) => deckId);

  const batch = [...vocabWrites, ...quizWrites, ...shadowWrites, ...singletonWrites];
  if (doomedDeckIds.length > 0) {
    batch.push(
      prisma.deckSubscription.deleteMany({
        where: { userId, deckId: { in: doomedDeckIds } },
      })
    );
  }

  if (batch.length > 0) {
    await prisma.$transaction(batch, { timeout: 30000 });
  }

  await writeDeckSubscriptions(prisma, userId, payload, deckStamps, doomedDeckIds);
}

/**
 * Đăng ký deck + trạng thái thẻ.
 *
 * Tách riêng vì phải ghi hai lượt: `DeckCardState` trỏ tới id của
 * `DeckSubscription`, mà id đó chỉ biết được sau khi upsert xong.
 */
async function writeDeckSubscriptions(
  prisma: PrismaClient,
  userId: string,
  payload: SyncPayload,
  deckStamps: StampMap,
  doomedDeckIds: string[]
): Promise<void> {
  const doomed = new Set(doomedDeckIds);
  const incoming = payload.deckSubscriptions.filter(
    (s) => !doomed.has(s.deckId) && isNewer(deckStamps, s.deckId, s.updatedAt)
  );
  if (incoming.length === 0) return;

  const subWrites = incoming.map((s) => {
    const data = {
      subscribedAt: new Date(s.subscribedAt),
      studiedWords: s.studiedWords,
      updatedAt: new Date(s.updatedAt),
    };
    return prisma.deckSubscription.upsert({
      where: { userId_deckId: { userId, deckId: s.deckId } },
      create: { userId, deckId: s.deckId, ...data },
      update: data,
    });
  });

  await prisma.$transaction(subWrites, { timeout: 30000 });

  const rows = await prisma.deckSubscription.findMany({
    where: { userId, deckId: { in: incoming.map((s) => s.deckId) } },
    select: { id: true, deckId: true },
  });
  const subIdByDeck = new Map(rows.map((r) => [r.deckId, r.id]));

  const cardWrites: Prisma.PrismaPromise<unknown>[] = [];
  for (const sub of incoming) {
    const subscriptionId = subIdByDeck.get(sub.deckId);
    if (!subscriptionId) continue;
    for (const [word, card] of Object.entries(sub.cardStates)) {
      const columns = cardToColumns(card);
      cardWrites.push(
        prisma.deckCardState.upsert({
          where: { subscriptionId_word: { subscriptionId, word } },
          create: { subscriptionId, word, ...columns, updatedAt: new Date(sub.updatedAt) },
          update: { ...columns, updatedAt: new Date(sub.updatedAt) },
        })
      );
    }
  }

  // Một deck 5.000 từ sinh ra 5.000 lệnh upsert. Chia lô để không vượt giới
  // hạn tham số của Postgres và không giữ transaction mở quá lâu.
  const CHUNK = 500;
  for (let i = 0; i < cardWrites.length; i += CHUNK) {
    await prisma.$transaction(cardWrites.slice(i, i + CHUNK), { timeout: 30000 });
  }
}


/** Hình dạng dữ liệu mà `readSnapshot` trả về — client dùng làm kiểu của bản kéo về. */
export type SyncSnapshot = Awaited<ReturnType<typeof readSnapshot>>;
