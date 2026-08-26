import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  checkRateLimit,
  clientIpKey,
  rateLimitHeaders,
  rateLimitKey,
  rateLimitMessage,
  resetRateLimitStore,
  SHARED_FALLBACK_KEY,
  trackedBucketCount,
  type RateLimitRule,
} from "@/lib/rate-limit";

/**
 * Bộ đếm là trạng thái cấp module, dùng chung cho cả tiến trình. Không dọn
 * giữa các test thì lượt gọi của test trước làm test sau bị chặn oan.
 */
beforeEach(() => resetRateLimitStore());

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Mỗi test dùng tên xô riêng, để hai test không vô tình ăn chung hạn mức. */
function rule(name: string, limit: number, windowMs = MINUTE): RateLimitRule {
  return { name, limit, windowMs };
}

/** Header giả, đủ dùng cho phần đọc IP. */
function headers(map: Record<string, string>) {
  return { get: (name: string) => map[name.toLowerCase()] ?? null };
}

describe("checkRateLimit — một tầng", () => {
  it("cho qua khi còn dưới hạn mức và đếm ngược số suất còn lại", () => {
    const r = rule("duoi-han-muc", 3);

    const first = checkRateLimit("ip:1.1.1.1", r, 1000);
    expect(first.allowed).toBe(true);
    expect(first.limit).toBe(3);
    expect(first.remaining).toBe(2);
    expect(first.retryAfterSeconds).toBe(0);

    expect(checkRateLimit("ip:1.1.1.1", r, 2000).remaining).toBe(1);
    expect(checkRateLimit("ip:1.1.1.1", r, 3000).remaining).toBe(0);
  });

  it("chặn lượt vượt hạn mức và nói rõ phải đợi bao lâu", () => {
    const r = rule("vuot-han-muc", 3);
    checkRateLimit("ip:1.1.1.1", r, 1000);
    checkRateLimit("ip:1.1.1.1", r, 2000);
    checkRateLimit("ip:1.1.1.1", r, 3000);

    const blocked = checkRateLimit("ip:1.1.1.1", r, 4000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    // Lượt cũ nhất lúc 1000 rời cửa sổ ở 61.000, tức còn 57 giây nữa.
    expect(blocked.resetAt).toBe(61_000);
    expect(blocked.retryAfterSeconds).toBe(57);
  });

  it("lượt bị chặn không được tính vào bộ đếm, nếu không hạn mức tự siết dần", () => {
    const r = rule("chan-khong-tinh", 2);
    checkRateLimit("khoa", r, 0);
    checkRateLimit("khoa", r, 1000);

    // Dội liên tục trong lúc bị chặn.
    for (let t = 2000; t < 10_000; t += 1000) {
      expect(checkRateLimit("khoa", r, t).allowed).toBe(false);
    }

    // Hai lượt hợp lệ hết hạn ở 60.000 và 61.000. Nếu các lượt bị chặn kia có
    // được ghi vào xô thì lúc này vẫn còn bị chặn.
    expect(checkRateLimit("khoa", r, 61_001).allowed).toBe(true);
  });

  it("cửa sổ trượt: chỉ lượt cũ nhất hết hạn, không mở lại toàn bộ hạn mức", () => {
    const r = rule("cua-so-truot", 3);
    checkRateLimit("khoa", r, 1000);
    checkRateLimit("khoa", r, 2000);
    checkRateLimit("khoa", r, 3000);
    expect(checkRateLimit("khoa", r, 4000).allowed).toBe(false);

    // 61.001: lượt lúc 1000 đã ra khỏi cửa sổ, hai lượt kia thì chưa.
    const reopened = checkRateLimit("khoa", r, 61_001);
    expect(reopened.allowed).toBe(true);
    expect(reopened.remaining).toBe(0);

    // Đúng nghĩa "trượt": chỉ được thêm một suất, không phải ba.
    expect(checkRateLimit("khoa", r, 61_002).allowed).toBe(false);
  });

  it("hết hẳn cửa sổ thì hạn mức mở lại đầy đủ", () => {
    const r = rule("het-cua-so", 2);
    checkRateLimit("khoa", r, 1000);
    checkRateLimit("khoa", r, 2000);
    expect(checkRateLimit("khoa", r, 3000).allowed).toBe(false);

    const after = checkRateLimit("khoa", r, 1000 + MINUTE + 5000);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(1);
  });

  it("hai khoá khác nhau đếm riêng, không chặn nhầm nhau", () => {
    const r = rule("hai-khoa", 2);
    checkRateLimit("ip:1.1.1.1", r, 0);
    checkRateLimit("ip:1.1.1.1", r, 1000);
    expect(checkRateLimit("ip:1.1.1.1", r, 2000).allowed).toBe(false);

    const other = checkRateLimit("ip:2.2.2.2", r, 2000);
    expect(other.allowed).toBe(true);
    expect(other.remaining).toBe(1);
  });

  it("hai quy tắc khác tên đếm riêng, dù cùng một khoá", () => {
    const a = rule("route-a", 1);
    const b = rule("route-b", 1);
    expect(checkRateLimit("khoa", a, 0).allowed).toBe(true);
    expect(checkRateLimit("khoa", b, 0).allowed).toBe(true);
    expect(checkRateLimit("khoa", a, 0).allowed).toBe(false);
  });
});

describe("checkRateLimit — chồng nhiều tầng (phút + giờ)", () => {
  const rules = [rule("ai-burst", 2), rule("ai-hourly", 3, HOUR)];

  it("tầng phút chặn trước, rồi tầng giờ chặn tiếp dù đã sang phút mới", () => {
    expect(checkRateLimit("khoa", rules, 0).allowed).toBe(true);
    expect(checkRateLimit("khoa", rules, 1000).allowed).toBe(true);
    // Hết suất của tầng phút.
    expect(checkRateLimit("khoa", rules, 2000).allowed).toBe(false);

    // Sang phút mới: tầng phút sạch, nhưng tầng giờ chỉ còn đúng một suất.
    const third = checkRateLimit("khoa", rules, 61_001);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const blockedByHour = checkRateLimit("khoa", rules, 62_000);
    expect(blockedByHour.allowed).toBe(false);
    // Phải đợi tới khi lượt lúc t=0 rời cửa sổ giờ, chứ không phải hết phút.
    expect(blockedByHour.resetAt).toBe(HOUR);
    expect(blockedByHour.retryAfterSeconds).toBe(3538);
  });

  it("một tầng hết chỗ thì không tầng nào bị trừ suất", () => {
    // Đốt sạch tầng phút rồi dội thêm nhiều lượt bị chặn.
    checkRateLimit("khoa", rules, 0);
    checkRateLimit("khoa", rules, 1000);
    for (let t = 2000; t < 20_000; t += 1000) checkRateLimit("khoa", rules, t);

    // Tầng giờ vẫn phải còn đúng một suất chưa dùng.
    expect(checkRateLimit("khoa", rules, 61_001).allowed).toBe(true);
  });

  it("báo hạn mức của tầng chặt nhất, để header X-RateLimit-* không nói dối", () => {
    const result = checkRateLimit("khoa", rules, 0);
    expect(result.limit).toBe(2);
    expect(result.remaining).toBe(1);
  });
});

describe("dọn rác", () => {
  it("xoá xô đã hết hạn thay vì giữ mãi trong Map", () => {
    const r = rule("don-rac", 5);
    checkRateLimit("ip:1.1.1.1", r, 0);
    expect(trackedBucketCount()).toBe(1);

    // Sau một phút, lần gọi kế tiếp kích hoạt đợt quét: xô của IP cũ rỗng nên
    // bị xoá, chỉ còn xô vừa tạo.
    checkRateLimit("ip:2.2.2.2", r, 2 * MINUTE);
    expect(trackedBucketCount()).toBe(1);
  });

  it("giữ lại xô vẫn còn lượt gọi trong cửa sổ", () => {
    const r = rule("giu-lai", 5, HOUR);
    checkRateLimit("ip:1.1.1.1", r, 0);
    checkRateLimit("ip:2.2.2.2", r, 2 * MINUTE);
    expect(trackedBucketCount()).toBe(2);
  });
});

describe("lấy khoá từ header", () => {
  it("ưu tiên x-forwarded-for và chỉ lấy IP đầu tiên", () => {
    const key = clientIpKey(headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.1, 10.0.0.2" }));
    expect(key).toBe("ip:1.1.1.1");
  });

  it("lùi về x-real-ip khi không có x-forwarded-for", () => {
    expect(clientIpKey(headers({ "x-real-ip": "3.3.3.3" }))).toBe("ip:3.3.3.3");
  });

  it("không có header nào thì dùng khoá chung", () => {
    expect(clientIpKey(headers({}))).toBe(SHARED_FALLBACK_KEY);
  });

  it("x-forwarded-for rỗng cũng phải lùi về x-real-ip", () => {
    const key = clientIpKey(headers({ "x-forwarded-for": "  ", "x-real-ip": "3.3.3.3" }));
    expect(key).toBe("ip:3.3.3.3");
  });

  it("đã đăng nhập thì khoá theo tài khoản, không theo IP", () => {
    const h = headers({ "x-forwarded-for": "1.1.1.1" });
    expect(rateLimitKey(h, "user-123")).toBe("user:user-123");
    expect(rateLimitKey(h, null)).toBe("ip:1.1.1.1");
  });

  it("hai người sau cùng một IP không chặn nhau khi đã đăng nhập", () => {
    const h = headers({ "x-forwarded-for": "1.1.1.1" });
    const r = rule("chung-ip", 1);
    expect(checkRateLimit(rateLimitKey(h, "user-a"), r, 0).allowed).toBe(true);
    expect(checkRateLimit(rateLimitKey(h, "user-b"), r, 0).allowed).toBe(true);
  });
});

describe("header và thông báo trả cho client", () => {
  it("còn suất thì không đặt Retry-After", () => {
    const r = rule("header-ok", 3);
    const h = rateLimitHeaders(checkRateLimit("khoa", r, 1000));
    expect(h["X-RateLimit-Limit"]).toBe("3");
    expect(h["X-RateLimit-Remaining"]).toBe("2");
    // Quy ước là epoch giây, không phải mili-giây.
    expect(h["X-RateLimit-Reset"]).toBe("61");
    expect(h["Retry-After"]).toBeUndefined();
  });

  it("bị chặn thì có Retry-After và thông báo tiếng Việt", () => {
    const r = rule("header-chan", 1);
    checkRateLimit("khoa", r, 1000);
    const blocked = checkRateLimit("khoa", r, 2000);

    expect(rateLimitHeaders(blocked)["Retry-After"]).toBe("59");
    expect(rateLimitMessage(blocked)).toBe("Bạn gọi quá nhanh. Thử lại sau 59 giây.");
  });
});

describe("mặc định dùng đồng hồ thật", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("không truyền `now` thì lấy Date.now(), và cửa sổ vẫn trượt theo thời gian", () => {
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
    const r = rule("dong-ho-that", 1);

    expect(checkRateLimit("khoa", r).allowed).toBe(true);
    expect(checkRateLimit("khoa", r).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-06-15T12:01:01.000Z"));
    expect(checkRateLimit("khoa", r).allowed).toBe(true);
  });
});
