import type { NextConfig } from "next";

/**
 * Khi chạy e2e, tắt overlay dev của Next.js: nó nằm đè lên thanh điều hướng
 * dưới ở khổ điện thoại và nuốt click của test. Chỉ ảnh hưởng lúc chạy test,
 * dev thường vẫn giữ nguyên indicator.
 */
const isE2E = process.env.PLAYWRIGHT_E2E === "1";

const nextConfig: NextConfig = {
  output: "standalone",
  // Không còn `typescript.ignoreBuildErrors`: build phải đỏ ngay khi type sai.
  reactStrictMode: true,
  ...(isE2E ? { devIndicators: false as const } : {}),
};

export default nextConfig;
