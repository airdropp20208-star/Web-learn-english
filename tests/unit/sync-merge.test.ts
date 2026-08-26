import { describe, it, expect } from "vitest";

import {
  emptySnapshot,
  mergeById,
  mergeDeckSubscriptions,
  mergeSingle,
  mergeSnapshots,
  unionById,
  type SyncSnapshot,
} from "@/lib/sync";
import type { DeckSubscription } from "@/lib/deck-storage-local";

/**
 * Các hàm hợp nhất là tim của toàn bộ đồng bộ: sai ở đây nghĩa là người dùng
 * mất buổi học, không phải một lỗi hiển thị. Test bám sát đúng những tình
 * huống thật gây mất dữ liệu — không phải chỉ gọi cho có.
 */

function rec(id: string, updatedAt: number, tag = "") {
  return { id, updatedAt, tag };
}

function sub(deckId: string, updatedAt: number, studied: number[] = []): DeckSubscription {
  return {
    deckId,
    subscribedAt: 0,
    studiedWords: studied,
    cardStates: {},
    updatedAt,
  };
}

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((i) => [i.id, i]));
}

describe("mergeById", () => {
  it("giữ bản có updatedAt lớn hơn, bất kể nó ở bên nào", () => {
    const merged = byId(
      mergeById(
        [rec("a", 200, "local-moi"), rec("b", 100, "local-cu")],
        [rec("a", 100, "remote-cu"), rec("b", 200, "remote-moi")]
      )
    );
    expect(merged.a.tag).toBe("local-moi");
    expect(merged.b.tag).toBe("remote-moi");
  });

  it("hoà thì lấy local — người dùng đang ngồi trước máy này", () => {
    const merged = mergeById([rec("a", 100, "local")], [rec("a", 100, "remote")]);
    expect(merged[0].tag).toBe("local");
  });

  it("hợp cả hai bên, không bỏ rơi bản ghi chỉ có ở một bên", () => {
    const merged = mergeById([rec("a", 1)], [rec("b", 1)]);
    expect(merged.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("không mất bản ghi khi một bên rỗng", () => {
    expect(mergeById([rec("a", 1)], [])).toHaveLength(1);
    expect(mergeById([], [rec("a", 1)])).toHaveLength(1);
  });

  it("bản ghi cũ chưa có updatedAt (=0) thua bản đã đồng bộ", () => {
    const merged = mergeById([rec("a", 0, "chua-dong-bo")], [rec("a", 5, "server")]);
    expect(merged[0].tag).toBe("server");
  });
});

describe("unionById", () => {
  it("gộp theo id mà không cần so mốc thời gian", () => {
    const merged = unionById([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]);
    expect(merged.map((r) => r.id).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("mergeSingle", () => {
  it("null thua mọi giá trị, ở cả hai phía", () => {
    const value = { updatedAt: 1 };
    expect(mergeSingle(null, value)).toBe(value);
    expect(mergeSingle(value, null)).toBe(value);
    expect(mergeSingle(null, null)).toBeNull();
  });

  it("bản mới hơn thắng; hoà thì local thắng", () => {
    expect(mergeSingle({ updatedAt: 2 }, { updatedAt: 1 })?.updatedAt).toBe(2);
    expect(mergeSingle({ updatedAt: 1 }, { updatedAt: 2 })?.updatedAt).toBe(2);
    const local = { updatedAt: 1 };
    expect(mergeSingle(local, { updatedAt: 1 })).toBe(local);
  });
});

describe("mergeDeckSubscriptions", () => {
  it("bia mộ mới hơn thì deck bị bỏ — huỷ đăng ký mới thật sự đồng bộ được", () => {
    const merged = mergeDeckSubscriptions([], [sub("d1", 100)], { d1: 200 });
    expect(merged).toHaveLength(0);
  });

  it("học lại deck sau khi huỷ thì deck ở lại — bia mộ cũ hơn nên thua", () => {
    const merged = mergeDeckSubscriptions([sub("d1", 300)], [sub("d1", 100)], {
      d1: 200,
    });
    expect(merged.map((s) => s.deckId)).toEqual(["d1"]);
    expect(merged[0].updatedAt).toBe(300);
  });

  it("không trả về trường `id` tạm dùng để hợp nhất", () => {
    const merged = mergeDeckSubscriptions([sub("d1", 1)], [], {});
    expect(merged[0]).not.toHaveProperty("id");
    expect(Object.keys(merged[0]).sort()).toEqual([
      "cardStates",
      "deckId",
      "studiedWords",
      "subscribedAt",
      "updatedAt",
    ]);
  });

  it("tiến độ deck mới hơn thắng, không bị bản server cũ ghi đè", () => {
    const merged = mergeDeckSubscriptions(
      [sub("d1", 500, [1, 2, 3])],
      [sub("d1", 100, [])],
      {}
    );
    expect(merged[0].studiedWords).toEqual([1, 2, 3]);
  });
});

describe("mergeSnapshots", () => {
  function snapshot(over: Partial<SyncSnapshot>): SyncSnapshot {
    return { ...emptySnapshot(), ...over };
  }

  it("hợp nhất từng bộ sưu tập độc lập với nhau", () => {
    const merged = mergeSnapshots(
      snapshot({
        texts: [{ id: "t1", updatedAt: 200 }] as SyncSnapshot["texts"],
        vocabItems: [{ id: "v1", updatedAt: 100 }] as SyncSnapshot["vocabItems"],
      }),
      snapshot({
        texts: [{ id: "t1", updatedAt: 100 }] as SyncSnapshot["texts"],
        vocabItems: [{ id: "v1", updatedAt: 200 }] as SyncSnapshot["vocabItems"],
      })
    );
    expect(merged.texts[0].updatedAt).toBe(200);
    expect(merged.vocabItems[0].updatedAt).toBe(200);
  });

  it("gộp bia mộ của hai bên, cùng deck thì lấy mốc xoá muộn hơn", () => {
    const merged = mergeSnapshots(
      snapshot({ deckTombstones: { d1: 100, d2: 50 } }),
      snapshot({ deckTombstones: { d1: 300 } })
    );
    expect(merged.deckTombstones).toEqual({ d1: 300, d2: 50 });
  });

  it("bia mộ của local áp lên deck mà chỉ server còn giữ", () => {
    const merged = mergeSnapshots(
      snapshot({ deckTombstones: { d1: 500 } }),
      snapshot({ deckSubscriptions: [sub("d1", 100)] })
    );
    expect(merged.deckSubscriptions).toHaveLength(0);
  });

  it("hợp nhất là idempotent: chạy lại trên chính kết quả không đổi gì", () => {
    const local = snapshot({
      texts: [{ id: "t1", updatedAt: 200 }] as SyncSnapshot["texts"],
      deckSubscriptions: [sub("d1", 10)],
      deckTombstones: { d2: 5 },
    });
    const remote = snapshot({
      texts: [{ id: "t2", updatedAt: 100 }] as SyncSnapshot["texts"],
      deckSubscriptions: [sub("d3", 20)],
    });
    const once = mergeSnapshots(local, remote);
    const twice = mergeSnapshots(once, once);
    expect(twice).toEqual(once);
  });

  it("một bên rỗng hoàn toàn thì kết quả đúng bằng bên kia", () => {
    const only = snapshot({
      texts: [{ id: "t1", updatedAt: 1 }] as SyncSnapshot["texts"],
      gamification: { updatedAt: 9 } as SyncSnapshot["gamification"],
      deckSubscriptions: [sub("d1", 3)],
    });
    expect(mergeSnapshots(only, emptySnapshot())).toEqual(only);
    expect(mergeSnapshots(emptySnapshot(), only)).toEqual(only);
  });
});
