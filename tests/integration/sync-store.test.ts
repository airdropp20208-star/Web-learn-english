/**
 * Test tích hợp cho tầng đọc/ghi đồng bộ.
 *
 * **Chạy khi nào:** chỉ khi có `DATABASE_URL` trỏ tới một Postgres đã
 * `prisma migrate deploy`. Không có thì cả file tự bỏ qua — để `npm run test`
 * vẫn xanh trên máy chưa dựng database.
 *
 *     docker run -d --name pg-test -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16
 *     export DATABASE_URL=postgresql://postgres:test@localhost:5433/postgres
 *     npx prisma migrate deploy
 *     npm run test:integration
 *
 * **Cảnh báo:** file này tự tạo và tự xoá user của riêng nó (email có tiền tố
 * `sync-it-`). Nó không đụng tới dữ liệu khác, nhưng đừng trỏ vào database
 * production.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { syncSnapshotSchema, type SyncPayload } from "@/server/sync-schema";

const hasDb = Boolean(process.env.DATABASE_URL);

// ==========================================================================
// Dựng payload
// ==========================================================================

const T0 = 1_700_000_000_000;

function emptyPayload(): SyncPayload {
  return {
    texts: [],
    vocabItems: [],
    memoryItems: [],
    quizQuestions: [],
    shadowSessions: [],
    userProgress: null,
    pathProgress: null,
    gamification: null,
    deckSubscriptions: [],
    deckTombstones: {},
  };
}

function card() {
  return {
    due: new Date(T0 + 86_400_000).toISOString(),
    stability: 3.5,
    difficulty: 5.1,
    elapsed_days: 1,
    scheduled_days: 2,
    learning_steps: 0,
    reps: 3,
    lapses: 1,
    state: 2,
    last_review: new Date(T0).toISOString(),
  };
}

function text(id: string, updatedAt: number, title = "Bài đọc thử") {
  return {
    id,
    title,
    content: "The quick brown fox jumps over the lazy dog.",
    cefrLevel: "B1" as const,
    summary: null,
    readability: {
      fleschKincaid: 4.2,
      fleschReading: 80.1,
      cefrEstimate: "A2" as const,
      wordCount: 9,
    },
    createdAt: T0,
    updatedAt,
  };
}

function memoryItem(id: string, textId: string, updatedAt: number) {
  return {
    id,
    sourceTextId: textId,
    itemType: "word" as const,
    refText: "fox",
    cefrLevel: "B1" as const,
    card: card(),
    createdAt: T0,
    updatedAt,
  };
}

/** Chốt chặn: mọi payload trong file này phải qua được đúng schema mà route dùng. */
function valid(payload: SyncPayload): SyncPayload {
  const parsed = syncSnapshotSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      "Payload test không hợp lệ: " +
        JSON.stringify(parsed.error.issues.slice(0, 3))
    );
  }
  return parsed.data;
}

// ==========================================================================

describe.skipIf(!hasDb)("sync-store trên Postgres thật", () => {
  let prisma: PrismaClient;
  let readSnapshot: typeof import("@/server/sync-store").readSnapshot;
  let writeSnapshot: typeof import("@/server/sync-store").writeSnapshot;
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    // Import động: `@/lib/prisma` ném lỗi ngay khi gọi `getPrisma()` nếu thiếu
    // DATABASE_URL, mà import tĩnh vẫn chạy cả khi describe bị bỏ qua.
    const store = await import("@/server/sync-store");
    readSnapshot = store.readSnapshot;
    writeSnapshot = store.writeSnapshot;
    prisma = (await import("@/lib/prisma")).getPrisma();

    const [a, b] = await Promise.all([
      prisma.user.create({ data: { email: `sync-it-a-${T0}@example.test` } }),
      prisma.user.create({ data: { email: `sync-it-b-${T0}@example.test` } }),
    ]);
    userA = a.id;
    userB = b.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    // Xoá user là đủ: mọi bảng con đều `onDelete: Cascade`.
    await prisma.user.deleteMany({
      where: { email: { startsWith: "sync-it-" } },
    });
    await prisma.$disconnect();
  });

  it("ghi rồi đọc lại đúng những gì đã ghi", async () => {
    const payload = valid({
      ...emptyPayload(),
      texts: [text("t1", T0)],
      memoryItems: [memoryItem("m1", "t1", T0)],
      vocabItems: [
        {
          id: "v1",
          word: "fox",
          definition: "a wild animal",
          vietnamese: "con cáo",
          exampleSentence: "The fox ran.",
          exampleVietnamese: "Con cáo chạy.",
          contextSentence: "The quick brown fox jumps.",
          cefrLevel: "B1",
          ipa: "/fɒks/",
          audioUrl: null,
          sourceTextId: "t1",
          memoryItemId: "m1",
          createdAt: T0,
          updatedAt: T0,
        },
      ],
      gamification: {
        coins: 120,
        xp: 340,
        level: 4,
        streak: 7,
        lastStudyDate: "2026-08-20",
        todayProgress: {
          date: "2026-08-20",
          wordsLearned: 5,
          wordsReviewed: 12,
          gamesPlayed: 1,
        },
        achievements: ["first-word"],
        updatedAt: T0,
      },
    });

    await writeSnapshot(prisma, userA, payload);
    const snap = await readSnapshot(prisma, userA);

    expect(snap.texts).toHaveLength(1);
    expect(snap.texts[0].title).toBe("Bài đọc thử");
    expect(snap.texts[0].readability?.wordCount).toBe(9);
    expect(snap.memoryItems).toHaveLength(1);
    // Trạng thái FSRS phải đi qua nguyên vẹn — `learning_steps` từng bị rơi mất.
    expect(snap.memoryItems[0].card.learning_steps).toBe(0);
    expect(snap.memoryItems[0].card.stability).toBeCloseTo(3.5);
    expect(snap.vocabItems[0].vietnamese).toBe("con cáo");
    expect(snap.gamification?.coins).toBe(120);
    expect(snap.gamification?.todayProgress.wordsReviewed).toBe(12);
  });

  it("bản cũ hơn không đè được bản mới trên server", async () => {
    await writeSnapshot(
      prisma,
      userA,
      valid({ ...emptyPayload(), texts: [text("t2", T0 + 5000, "Bản mới")] })
    );
    await writeSnapshot(
      prisma,
      userA,
      valid({ ...emptyPayload(), texts: [text("t2", T0 + 1000, "Bản cũ")] })
    );

    const snap = await readSnapshot(prisma, userA);
    expect(snap.texts.find((t) => t.id === "t2")?.title).toBe("Bản mới");
  });

  it("bản mới hơn thì ghi đè", async () => {
    await writeSnapshot(
      prisma,
      userA,
      valid({ ...emptyPayload(), texts: [text("t3", T0, "Trước")] })
    );
    await writeSnapshot(
      prisma,
      userA,
      valid({ ...emptyPayload(), texts: [text("t3", T0 + 9000, "Sau")] })
    );

    const snap = await readSnapshot(prisma, userA);
    expect(snap.texts.find((t) => t.id === "t3")?.title).toBe("Sau");
  });

  it("thẻ trỏ tới bài đọc không tồn tại thì bị loại, không làm hỏng cả lượt", async () => {
    await writeSnapshot(
      prisma,
      userA,
      valid({
        ...emptyPayload(),
        texts: [text("t4", T0)],
        memoryItems: [
          memoryItem("m-ok", "t4", T0),
          memoryItem("m-mo-coi", "khong-ton-tai", T0),
        ],
      })
    );

    const ids = (await readSnapshot(prisma, userA)).memoryItems.map((m) => m.id);
    expect(ids).toContain("m-ok");
    expect(ids).not.toContain("m-mo-coi");
  });

  it("dữ liệu của hai người dùng không lẫn vào nhau", async () => {
    await writeSnapshot(
      prisma,
      userB,
      valid({ ...emptyPayload(), texts: [text("t-b", T0, "Của B")] })
    );

    const snapA = await readSnapshot(prisma, userA);
    const snapB = await readSnapshot(prisma, userB);

    expect(snapA.texts.map((t) => t.id)).not.toContain("t-b");
    expect(snapB.texts.map((t) => t.id)).toEqual(["t-b"]);
  });

  it("bia mộ mới hơn thì gỡ đăng ký deck", async () => {
    await writeSnapshot(
      prisma,
      userA,
      valid({
        ...emptyPayload(),
        deckSubscriptions: [
          {
            deckId: "essential-4000",
            subscribedAt: T0,
            studiedWords: [1, 2, 3],
            cardStates: { fox: card() },
            updatedAt: T0,
          },
        ],
      })
    );
    expect((await readSnapshot(prisma, userA)).deckSubscriptions).toHaveLength(1);

    await writeSnapshot(
      prisma,
      userA,
      valid({ ...emptyPayload(), deckTombstones: { "essential-4000": T0 + 1000 } })
    );
    expect((await readSnapshot(prisma, userA)).deckSubscriptions).toHaveLength(0);
  });

  it("bia mộ cũ hơn lần đăng ký lại thì deck vẫn còn", async () => {
    await writeSnapshot(
      prisma,
      userA,
      valid({
        ...emptyPayload(),
        deckSubscriptions: [
          {
            deckId: "oxford-5000",
            subscribedAt: T0 + 8000,
            studiedWords: [],
            cardStates: {},
            updatedAt: T0 + 8000,
          },
        ],
        deckTombstones: { "oxford-5000": T0 + 2000 },
      })
    );

    const snap = await readSnapshot(prisma, userA);
    expect(snap.deckSubscriptions.map((d) => d.deckId)).toContain("oxford-5000");
  });

  it("ghi lại cùng một ảnh chụp hai lần cho kết quả y hệt", async () => {
    const payload = valid({
      ...emptyPayload(),
      texts: [text("t-idem", T0)],
      memoryItems: [memoryItem("m-idem", "t-idem", T0)],
    });

    await writeSnapshot(prisma, userA, payload);
    const once = await readSnapshot(prisma, userA);
    await writeSnapshot(prisma, userA, payload);
    const twice = await readSnapshot(prisma, userA);

    expect(twice).toEqual(once);
  });

  it("ảnh chụp rỗng không xoá gì cả", async () => {
    const before = await readSnapshot(prisma, userA);
    await writeSnapshot(prisma, userA, valid(emptyPayload()));
    const after = await readSnapshot(prisma, userA);

    expect(after.texts).toHaveLength(before.texts.length);
    expect(after.memoryItems).toHaveLength(before.memoryItems.length);
  });
});
