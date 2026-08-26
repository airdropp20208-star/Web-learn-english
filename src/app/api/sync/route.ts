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

import { getSessionUserId, isAuthConfigured } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { syncSnapshotSchema } from "@/server/sync-schema";
import { readSnapshot, writeSnapshot } from "@/server/sync-store";

export const runtime = "nodejs";
/** Dữ liệu riêng của từng người — không được cache ở bất kỳ tầng nào. */
export const dynamic = "force-dynamic";

export async function GET() {
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

  try {
    const snapshot = await readSnapshot(getPrisma(), userId);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
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
    return NextResponse.json({ ok: true, syncedAt: Date.now() });
  } catch (err) {
    console.error("[sync] POST thất bại:", err);
    return NextResponse.json(
      { error: "Không ghi được dữ liệu đồng bộ." },
      { status: 500 }
    );
  }
}
