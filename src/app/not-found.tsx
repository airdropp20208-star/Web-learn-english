import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Compass className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Không có trang này</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Đường dẫn bạn mở không tồn tại. Toàn bộ app nằm ở trang chính — các
          mục học đều là tab trong đó chứ không phải trang riêng.
        </p>
      </div>

      <Button asChild>
        <Link href="/?app=1">Về trang học</Link>
      </Button>
    </div>
  );
}
