/**
 * Đầu mối đồng bộ: GET để kéo về, POST để đẩy lên.
 *
 * Chỗ này chỉ còn lo phần HTTP: kiểm cấu hình, xác định ai đang gọi, kiểm tra
 * dữ liệu vào, ánh xạ lỗi sang mã trạng thái. Toàn bộ việc đọc/ghi database
 * nằm ở `@/server/sync-store` — tách ra để test tích hợp gọi thẳng được, vì
 * Next không cho route file export thêm tên nào ngoài các phương thức HTTP.
 *
 * Quy tắc bất di bất dịch: `userId` **luôn** lấy từ session. Payload có gửi
 * kèm id nào cũng bị bỏ. Đây là ranh giới duy nhất giữa dữ liệu của người này
 * và người khác.
 */
import { NextResponse } from "next/server";

import { guardRequest } from "@/lib/api-guard";
import { getSessionUserId, isAuthConfigured } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { syncSnapshotSchema } from "@/server/sync-schema";
import { readSnapshot, writeSnapshot } from "@/server/sync-store";

export const runtime = "nodejs";
/** Dữ liệu riêng của từng người — không được cache ở bất kỳ tầng nào. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Máy chủ chưa cấu hình tài khoản. Đồng bộ không khả dụng." },
      { status: 503 }
    );
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  // Đếm hạn mức sau khi đã biết `userId`, và truyền nó vào để khoá theo tài
  // khoản thay vì theo IP — cả nhà chung một IP thì không chặn nhầm nhau.
  const gate = await guardRequest(request, RATE_LIMITS.syncPull, { userId });
  if (!gate.ok) return gate.response;

  try {
    const snapshot = await readSnapshot(getPrisma(), userId);
    return NextResponse.json(snapshot, {
      headers: { ...gate.headers, "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[sync] GET thất bại:", err);
    return NextResponse.json(
      { error: "Không đọc được dữ liệu đồng bộ." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Máy chủ chưa cấu hình tài khoản. Đồng bộ không khả dụng." },
      { status: 503 }
    );
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const gate = await guardRequest(request, RATE_LIMITS.syncPush, { userId });
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body không phải JSON hợp lệ." }, { status: 400 });
  }

  const parsed = syncSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu đồng bộ không hợp lệ.", issues: parsed.error.issues.slice(0, 10) },
      { status: 400 }
    );
  }

  try {
    await writeSnapshot(getPrisma(), userId, parsed.data);
    return NextResponse.json({ ok: true, syncedAt: Date.now() }, { headers: gate.headers });
  } catch (err) {
    console.error("[sync] POST thất bại:", err);
    return NextResponse.json(
      { error: "Không ghi được dữ liệu đồng bộ." },
      { status: 500 }
    );
  }
}
