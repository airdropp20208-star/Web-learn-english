"use client";

/**
 * Lỗi ném ra từ chính `layout.tsx` không có layout nào bọc ngoài để hiển thị,
 * nên file này phải tự dựng cả `<html>` và `<body>`.
 *
 * Cũng vì thế mà nó không dùng được component hay biến màu của app — lúc này
 * chưa chắc CSS đã nạp. Style viết thẳng, tiếng Việt không dấu-hoá gì cả.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1rem",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fff",
          color: "#18181b",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
          Ứng dụng không khởi động được
        </h1>
        <p style={{ maxWidth: "28rem", fontSize: "0.875rem", color: "#71717a", margin: 0 }}>
          Dữ liệu học của bạn vẫn nằm nguyên trong trình duyệt. Thử tải lại
          trang.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #d4d4d8",
            background: "#fff",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Thử lại
        </button>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#a1a1aa", margin: 0 }}>
            Mã lỗi: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
