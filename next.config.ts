import type { NextConfig } from "next";

/**
 * Khi chạy e2e, tắt overlay dev của Next.js: nó nằm đè lên thanh điều hướng
 * dưới ở khổ điện thoại và nuốt click của test. Chỉ ảnh hưởng lúc chạy test,
 * dev thường vẫn giữ nguyên indicator.
 */
const isE2E = process.env.PLAYWRIGHT_E2E === "1";
const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy.
 *
 * Nói thẳng giới hạn trước: `script-src` phải có `'unsafe-inline'` vì Next.js
 * chèn script bootstrap nội tuyến để hydrate, và next-themes chèn thêm một
 * đoạn nữa để đặt class `dark` trước lần vẽ đầu (bỏ nó đi thì màn hình nháy
 * trắng mỗi lần tải). Muốn bỏ `'unsafe-inline'` thì phải chuyển sang nonce
 * sinh trong middleware — làm được, nhưng là một thay đổi kiến trúc riêng chứ
 * không phải một dòng config. Nên phần chống XSS của CSP ở đây yếu; giá trị
 * thật nằm ở `frame-ancestors`, `object-src`, `base-uri`, `form-action` và
 * `connect-src` — chặn clickjacking, chặn plugin, chặn đổi base URL, và chặn
 * script rò dữ liệu ra máy chủ lạ.
 *
 * `connect-src 'self'` là cố ý chặt: mọi lệnh gọi mạng của trình duyệt đều đi
 * qua `/api/*` của chính app. Từ điển và Gemini đều được gọi từ phía máy chủ,
 * không phải từ trình duyệt.
 */
function buildCSP(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-eval' chỉ ở dev: HMR của Next.js cần nó, production thì không.
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // Tailwind và shadcn/ui đặt biến CSS qua thuộc tính style nội tuyến.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    // Audio phát âm lấy từ Free Dictionary API, và bản ghi âm của tab Luyện
    // nói phát lại qua blob: URL sinh tại chỗ.
    "media-src": ["'self'", "blob:", "data:", "https:"],
    "connect-src": ["'self'", ...(isDev ? ["ws:"] : [])],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

const nextConfig: NextConfig = {
  // Không đặt `output: "standalone"`: đó là chế độ đóng gói cho Docker, tự
  // gom node_modules vào một thư mục chạy độc lập. Vercel dựng bundle theo
  // cách riêng của nó, nên bật standalone chỉ làm build lâu hơn và dễ lệch
  // với thứ thực sự được chạy.
  // Không còn `typescript.ignoreBuildErrors`: build phải đỏ ngay khi type sai.
  reactStrictMode: true,
  ...(isE2E ? { devIndicators: false as const } : {}),

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: buildCSP() },
          // Dư thừa có chủ ý so với frame-ancestors: trình duyệt cũ không
          // hiểu CSP level 2 vẫn tôn trọng header này.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // microphone=(self) là bắt buộc — tab Luyện nói ghi âm giọng người
          // học. Cắt nó đi là tắt hẳn một tính năng.
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
          },
          // Chỉ có ý nghĩa trên HTTPS; trên localhost trình duyệt bỏ qua.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
