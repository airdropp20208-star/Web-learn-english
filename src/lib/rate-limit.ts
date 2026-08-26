/**
 * Giới hạn tần suất gọi API, đếm trong bộ nhớ của tiến trình.
 *
 * ## Nói thẳng về giới hạn của cách làm này
 *
 * Bộ đếm nằm trong một `Map` của **một tiến trình Node**. Trên Vercel, mỗi
 * serverless instance là một tiến trình riêng, có `Map` riêng, và số instance
 * co giãn theo lưu lượng. Hệ quả trực tiếp:
 *
 * - Có 4 instance đang chạy thì hạn mức thực tế là 4 lần con số ghi ở đây.
 * - Instance ngủ đông rồi khởi động lại (cold start) là bộ đếm về 0.
 * - Kẻ tấn công có chủ đích chỉ cần gửi song song để rơi vào nhiều instance,
 *   hoặc đổi IP, là đi qua được.
 *
 * Vậy đây **không phải** lớp chống tấn công. Nó là hàng rào chống lạm dụng
 * tình cờ: một vòng lặp `fetch` viết sai trong component, một tab bị treo gọi
 * lại liên tục, một người dùng bấm nút 50 lần. Đúng những thứ hay đốt hạn mức
 * Gemini và làm Google chặn IP nhất.
 *
 * Muốn giới hạn nghiêm túc thì phải đếm ở chỗ dùng chung giữa các instance —
 * Redis/Upstash (`@upstash/ratelimit`) hoặc Vercel Firewall. Khi đó chỉ cần
 * thay ruột `checkRateLimit`, phần còn lại của file và mọi route gọi nó không
 * phải sửa.
 *
 * ## Thuật toán
 *
 * Sliding window log: mỗi khoá giữ mảng mốc thời gian của các lượt gọi còn nằm
 * trong cửa sổ. Chọn log thay vì fixed window vì fixed window cho phép gấp đôi
 * hạn mức ở chỗ giáp ranh hai cửa sổ. Hạn mức ở đây chỉ vài chục nên mảng luôn
 * ngắn, không đáng lo về bộ nhớ hay chi phí cắt mảng.
 */

/** Một quy tắc: `limit` lượt gọi trong `windowMs` mili-giây. */
export type RateLimitRule = {
  /**
   * Tên xô đếm. Hai route khác nhau phải dùng tên khác nhau, nếu không chúng
   * ăn chung hạn mức của nhau.
   */
  name: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** Hạn mức của quy tắc chặt nhất đang áp — dùng cho `X-RateLimit-Limit`. */
  limit: number;
  /** Số lượt còn lại của quy tắc chặt nhất. */
  remaining: number;
  /** Epoch ms khi lượt gọi cũ nhất rời khỏi cửa sổ, tức lúc có thêm chỗ trống. */
  resetAt: number;
  /** Số giây nên đợi, làm tròn lên. Bằng 0 khi request được cho qua. */
  retryAfterSeconds: number;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Hạn mức cho từng route.
 *
 * Bối cảnh chọn số: đây là app học tiếng Anh cá nhân, vài người dùng, không
 * phải dịch vụ công cộng. Nên tiêu chí không phải "chịu được bao nhiêu tải" mà
 * là "cao hơn nhịp dùng thật bao nhiêu lần thì vẫn chặn được vòng lặp hỏng".
 * Tất cả tính trên **một khoá** (một IP, hoặc một tài khoản khi đã đăng nhập).
 */
export const RATE_LIMITS = {
  /**
   * Dịch: gọi endpoint Google không chính thức (không key, không hợp đồng).
   * Lạm dụng là bị chặn IP, mà chặn thì cả app mất tính năng dịch chứ không
   * riêng người gây ra.
   *
   * Nhịp thật: nhập một bài từ thư viện dịch tuần tự ~8 từ; tab từ vựng dịch
   * tối đa 5 từ mỗi lần nạp. Route lại có cache trong bộ nhớ nên từ lặp không
   * ra ngoài. 60 lượt/phút (trung bình 1 giây một lượt) thoải mái cho các đợt
   * nhập đó mà vẫn chặn được vòng lặp `fetch` chạy loạn.
   */
  translate: { name: "translate", limit: 60, windowMs: MINUTE },

  /**
   * Kiểm tra ngữ pháp: proxy LanguageTool public API. Bên họ tự giới hạn
   * 20 request/phút cho mỗi IP dùng miễn phí, nên hạn mức của ta phải nằm
   * **dưới** mức đó — vượt là họ trả 429 và người dùng nhận lỗi 502 khó hiểu.
   * 12/phút chừa biên an toàn.
   *
   * Còn một trần nữa của họ mà ta không chặn được ở đây: 75 KB văn bản mỗi
   * phút. Gửi liên tiếp vài request sát trần 20.000 ký tự vẫn có thể chạm trần
   * byte trước khi chạm trần số lượt.
   */
  grammar: { name: "grammar", limit: 12, windowMs: MINUTE },

  /**
   * Phân tích bài đọc: tra từ điển hàng loạt + một lượt gọi Gemini để tóm tắt.
   * Tốn tiền thật, và người dùng chỉ bấm khi vừa dán xong một bài — thực tế cỡ
   * một lượt mỗi vài phút.
   *
   * Hai tầng: 10/phút chặn bấm liên tục, 100/giờ chặn kiểu rỉ rả cả buổi. Chỉ
   * có tầng phút thì 10/phút vẫn là 600/giờ — hoá đơn không nhỏ.
   */
  analyze: [
    { name: "analyze-burst", limit: 10, windowMs: MINUTE },
    { name: "analyze-hourly", limit: 100, windowMs: HOUR },
  ],

  /**
   * Sinh quiz: prompt Gemini đắt nhất trong app vì nhét cả bài đọc lẫn danh
   * sách từ vựng vào. Làm xong một bộ quiz mất vài phút, nên 6/phút đã gấp
   * hơn chục lần nhịp dùng thật. Trần giờ đặt 60 vì cùng lý do như `analyze`.
   */
  quiz: [
    { name: "quiz-burst", limit: 6, windowMs: MINUTE },
    { name: "quiz-hourly", limit: 60, windowMs: HOUR },
  ],

  /**
   * Đồng bộ kéo về. Không gọi AI nhưng đọc cả ảnh chụp dữ liệu từ database.
   * Client gộp thay đổi với debounce 3 giây, tức tối đa ~20 lượt/phút khi
   * người dùng thao tác liên tục. 40 chừa gấp đôi cho lúc mở nhiều tab.
   */
  syncPull: { name: "sync-pull", limit: 40, windowMs: MINUTE },

  /** Đồng bộ đẩy lên: ghi database, body có thể tới vài MB. Cùng nhịp với kéo về. */
  syncPush: { name: "sync-push", limit: 40, windowMs: MINUTE },
} satisfies Record<string, RateLimitRule | RateLimitRule[]>;

type Bucket = {
  /** Mốc thời gian các lượt gọi còn trong cửa sổ, tăng dần. */
  hits: number[];
  windowMs: number;
};

const buckets = new Map<string, Bucket>();

/** Bao lâu quét dọn một lần. Quét theo thời gian chứ không phải mỗi request. */
const SWEEP_INTERVAL_MS = MINUTE;

/**
 * Trần số xô được theo dõi. Chạm trần nghĩa là đang bị rải rất nhiều khoá —
 * lúc đó thà xoá sạch (tạm mở cổng) còn hơn để `Map` ăn hết RAM và giết tiến
 * trình, vì chết tiến trình thì mọi người dùng đều mất dịch vụ.
 */
const MAX_TRACKED_BUCKETS = 20_000;

let lastSweepAt = 0;

/** Bỏ các mốc đã rời khỏi cửa sổ. Mảng tăng dần nên chỉ cần cắt từ đầu. */
function prune(bucket: Bucket, now: number): void {
  const cutoff = now - bucket.windowMs;
  let stale = 0;
  while (stale < bucket.hits.length && bucket.hits[stale] <= cutoff) stale++;
  if (stale > 0) bucket.hits.splice(0, stale);
}

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    prune(bucket, now);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
  lastSweepAt = now;
}

/**
 * Ghi nhận một lượt gọi cho `key` và cho biết có được đi tiếp không.
 *
 * Truyền nhiều quy tắc để chồng nhiều tầng (ví dụ vừa theo phút vừa theo giờ).
 * Chỉ khi **mọi** quy tắc còn chỗ thì lượt gọi mới được ghi vào các xô — nếu
 * ghi trước rồi mới kiểm tra thì một request bị chặn vẫn ăn mất suất ở tầng
 * khác, và hạn mức thực tế tụt xuống thấp hơn con số đã công bố.
 *
 * @param now cho phép test bơm thời gian vào; mặc định là đồng hồ thật.
 */
export function checkRateLimit(
  key: string,
  rules: RateLimitRule | RateLimitRule[],
  now: number = Date.now()
): RateLimitResult {
  const list = Array.isArray(rules) ? rules : [rules];
  if (list.length === 0) {
    throw new Error("checkRateLimit cần ít nhất một quy tắc.");
  }

  if (now - lastSweepAt >= SWEEP_INTERVAL_MS) sweep(now);
  if (buckets.size > MAX_TRACKED_BUCKETS) {
    console.warn(
      `[rate-limit] Vượt ${MAX_TRACKED_BUCKETS} xô đang theo dõi — xoá sạch để không phình bộ nhớ.`
    );
    buckets.clear();
  }

  const entries = list.map((rule) => {
    const bucketKey = `${rule.name}|${key}`;
    let bucket = buckets.get(bucketKey);
    // Đổi `windowMs` giữa chừng (sửa code, hot reload) thì mốc cũ không còn ý
    // nghĩa — dựng lại xô thay vì diễn giải chúng theo cửa sổ mới.
    if (!bucket || bucket.windowMs !== rule.windowMs) {
      bucket = { hits: [], windowMs: rule.windowMs };
      buckets.set(bucketKey, bucket);
    }
    prune(bucket, now);
    return { rule, bucket };
  });

  const blocked = entries.filter((entry) => entry.bucket.hits.length >= entry.rule.limit);
  if (blocked.length > 0) {
    // Nhiều tầng cùng chặn thì báo tầng phải đợi lâu nhất, để client không thử
    // lại sớm rồi lại ăn 429.
    let worst = blocked[0];
    let worstResetAt = 0;
    for (const entry of blocked) {
      const resetAt = (entry.bucket.hits[0] ?? now) + entry.bucket.windowMs;
      if (resetAt > worstResetAt) {
        worstResetAt = resetAt;
        worst = entry;
      }
    }
    return {
      allowed: false,
      limit: worst.rule.limit,
      remaining: 0,
      resetAt: worstResetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((worstResetAt - now) / 1000)),
    };
  }

  let tightest = entries[0];
  let tightestRemaining = Number.POSITIVE_INFINITY;
  for (const entry of entries) {
    entry.bucket.hits.push(now);
    const remaining = entry.rule.limit - entry.bucket.hits.length;
    if (remaining < tightestRemaining) {
      tightestRemaining = remaining;
      tightest = entry;
    }
  }

  return {
    allowed: true,
    limit: tightest.rule.limit,
    remaining: Math.max(0, tightestRemaining),
    resetAt: (tightest.bucket.hits[0] ?? now) + tightest.bucket.windowMs,
    retryAfterSeconds: 0,
  };
}

/** Xoá toàn bộ bộ đếm. Chỉ dùng trong test — mỗi test phải bắt đầu từ nền sạch. */
export function resetRateLimitStore(): void {
  buckets.clear();
  lastSweepAt = 0;
}

/** Số xô đang theo dõi. Dùng để test phần dọn rác. */
export function trackedBucketCount(): number {
  return buckets.size;
}

type HeadersLike = { get(name: string): string | null };

/**
 * Khoá dùng chung khi không đọc được IP nào.
 *
 * Gộp mọi người gọi không xác định vào một xô là có chủ ý: thà chặt tay với
 * đám không nhận diện được còn hơn để chúng gọi thoải mái. Chạy local
 * (`next dev`) thì không có header proxy nên mọi request đều rơi vào đây —
 * bình thường.
 */
export const SHARED_FALLBACK_KEY = "ip:unknown";

/**
 * IP của người gọi, lấy từ header proxy.
 *
 * Trên Vercel `x-forwarded-for` do biên của họ đặt nên tin được. Chạy sau
 * proxy khác thì header này là do client gửi và **giả được** — thêm một lý do
 * nữa để đừng coi đây là lớp bảo mật.
 */
export function clientIpKey(headers: HeadersLike): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // Chuỗi có dạng "client, proxy1, proxy2" — phần tử đầu là người gọi thật.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return `ip:${first}`;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return `ip:${realIp}`;

  return SHARED_FALLBACK_KEY;
}

/**
 * Khoá đếm cho một request.
 *
 * Có `userId` thì khoá theo tài khoản, vì IP là thước đo tồi: cả nhà hay cả
 * văn phòng dùng chung một IP NAT sẽ chặn nhầm nhau, còn một người đổi mạng
 * giữa chừng lại được cấp hạn mức mới. Khách chưa đăng nhập thì đành dùng IP.
 */
export function rateLimitKey(headers: HeadersLike, userId?: string | null): string {
  return userId ? `user:${userId}` : clientIpKey(headers);
}

/**
 * Header chuẩn để client biết còn bao nhiêu suất và bao giờ thử lại.
 * `Retry-After` chỉ đặt khi thật sự bị chặn — đặt lúc còn suất là sai nghĩa.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    // Quy ước chung là epoch **giây**, không phải mili-giây.
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }
  return headers;
}

/** Thông báo 429. Tiếng Việt, khớp phong cách lỗi của `/api/sync`. */
export function rateLimitMessage(result: RateLimitResult): string {
  return `Bạn gọi quá nhanh. Thử lại sau ${result.retryAfterSeconds} giây.`;
}
