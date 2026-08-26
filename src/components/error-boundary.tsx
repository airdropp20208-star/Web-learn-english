"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /**
   * Tên khu vực, để câu thông báo nói đúng chỗ hỏng thay vì "đã có lỗi".
   * Người dùng biết "tab Luyện nói hỏng" thì còn dùng tiếp chín tab kia;
   * "đã có lỗi" thì họ đóng app.
   */
  ten?: string;
}

interface State {
  error: Error | null;
}

/**
 * Chặn lỗi vẽ của một nhánh cây React để nó không kéo sập cả app.
 *
 * Không có boundary thì một lỗi trong bất kỳ tab nào — một `undefined.map`,
 * một API trả hình dạng lạ — sẽ unmount toàn bộ gốc và người dùng nhận màn
 * hình trắng, mất luôn cả thanh điều hướng để đi chỗ khác.
 *
 * Phải là class: React chưa có hook nào bắt được lỗi vẽ.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Giữ lại vết để còn gỡ được. Ở production React không tự in ra, mà đây
    // là thứ duy nhất người dùng có thể chụp lại gửi cho mình.
    console.error(
      `[error-boundary] ${this.props.ten ?? "Khu vực"} hỏng:`,
      error,
      info.componentStack
    );
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-base font-semibold">
            {this.props.ten ? `${this.props.ten} đang gặp lỗi` : "Phần này đang gặp lỗi"}
          </h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Tiến độ học của bạn vẫn an toàn — lỗi chỉ nằm ở phần hiển thị. Thử
            vẽ lại, hoặc chuyển sang mục khác rồi quay lại.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => this.setState({ error: null })}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Thử lại
        </Button>

        {/* Chi tiết kỹ thuật gập lại: người dùng thường không cần, nhưng khi
            cần báo lỗi thì phải có chỗ chép ra. */}
        <details className="w-full max-w-lg text-left">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Chi tiết kỹ thuật
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
            {error.message || String(error)}
          </pre>
        </details>
      </div>
    );
  }
}
