/**
 * Endpoint của Auth.js.
 *
 * Có một lớp chắn phía trước: khi máy chủ chưa cấu hình auth (thiếu
 * `DATABASE_URL` hoặc `AUTH_SECRET`), gọi thẳng `handlers` sẽ ném
 * `MissingSecret` và trả 500. Mà `SessionProvider` hỏi `/api/auth/session` ở
 * mỗi lần tải trang, nên 500 ở đó biến chế độ khách — vốn phải chạy được mà
 * không cần backend — thành một trang đầy lỗi console.
 *
 * Nên khi chưa cấu hình, ta tự trả lời hai endpoint mà client thật sự gọi
 * trong lúc chỉ đọc: `session` (chưa đăng nhập) và `providers` (không có
 * provider nào). Còn lại trả 503 kèm lý do rõ ràng.
 */
import type { NextRequest } from "next/server";

import { handlers, isAuthConfigured } from "@/lib/auth";

function endpointName(url: string): string {
  const path = new URL(url).pathname;
  return path.slice(path.lastIndexOf("/") + 1);
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

function guestResponse(request: NextRequest): Response | null {
  if (isAuthConfigured()) return null;

  switch (endpointName(request.url)) {
    // `null` là đúng hình dạng mà next-auth/react mong đợi cho "chưa đăng nhập".
    case "session":
      return Response.json(null, { headers: NO_STORE });
    case "providers":
      return Response.json({}, { headers: NO_STORE });
    // Client gửi log lỗi về đây. Trả lỗi cho một endpoint ghi log là tự tạo
    // thêm lỗi.
    case "_log":
      return new Response(null, { status: 204 });
    default:
      return Response.json(
        { error: "Máy chủ chưa cấu hình đăng nhập." },
        { status: 503, headers: NO_STORE }
      );
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  return guestResponse(request) ?? handlers.GET(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return guestResponse(request) ?? handlers.POST(request);
}
