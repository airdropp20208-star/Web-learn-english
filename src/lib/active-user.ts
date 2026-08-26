import { DEFAULT_USER_ID } from "./user-id";

/**
 * Ai đang dùng app trên trình duyệt này.
 *
 * Trước đây `gamification`, `path-progress` và `deck-storage` ghi vào những
 * khoá localStorage cố định, không gắn với người dùng nào. Khi chỉ có một
 * danh tính khách thì không sao. Có đăng nhập rồi thì đó là lỗi thật: hai tài
 * khoản đăng nhập lần lượt trên cùng máy sẽ dùng chung một kho điểm và một
 * tiến độ lộ trình.
 *
 * Module này giữ danh tính đang hoạt động và báo cho các store biết khi nó
 * đổi, để chúng nạp lại từ khoá của người mới.
 */

let activeUserId: string = DEFAULT_USER_ID;

type Listener = () => void;
const listeners = new Set<Listener>();

export function getActiveUserId(): string {
  return activeUserId;
}

/**
 * Đổi danh tính đang hoạt động. Gọi khi phiên đăng nhập thay đổi.
 * Không làm gì nếu id không đổi, để tránh nạp lại thừa.
 */
export function setActiveUserId(userId: string): void {
  if (userId === activeUserId) return;
  activeUserId = userId;
  for (const listener of listeners) listener();
}

export function subscribeActiveUser(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Khoá localStorage gắn với người dùng đang hoạt động.
 *
 * @param prefix tiền tố của kho, ví dụ `"gamification"`
 */
export function scopedKey(prefix: string): string {
  return `${prefix}:${activeUserId}`;
}

/**
 * Đọc kho của một người dùng cụ thể, bất kể ai đang hoạt động.
 *
 * Cần cho luồng "nhập tiến độ khách vào tài khoản": lúc đó người đang hoạt
 * động là tài khoản thật, nhưng ta phải đọc được kho của khách. Đổi tạm
 * `activeUserId` rồi đọc là cách sai — các store có cache riêng, đổi thầm
 * lặng thì chúng vẫn trả dữ liệu cũ.
 */
export function clearScopedFor(prefix: string, userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${prefix}:${userId}`);
  } catch {
    // localStorage bị chặn
  }
}

/**
 * Ghi vào kho của một người dùng cụ thể, bất kể ai đang hoạt động.
 *
 * Đối xứng với `readScopedFor`, và cần cho cùng lý do: engine đồng bộ ghi dữ
 * liệu đã hoà giải cho một danh tính xác định, chứ không phải "cho ai đang
 * đăng nhập lúc câu lệnh chạy tới".
 */
export function writeScopedFor(prefix: string, userId: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${prefix}:${userId}`, value);
  } catch {
    // localStorage đầy hoặc bị chặn
  }
}

export function readScopedFor(prefix: string, userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${prefix}:${userId}`);
  } catch {
    return null;
  }
}

/**
 * Đọc một kho đã đổi sang khoá có tên người dùng, nhưng vẫn nhận lại dữ liệu
 * cũ nằm ở khoá không phân vùng.
 *
 * Không có bước này thì lần đầu chạy bản mới, mọi người dùng hiện tại đều mất
 * sạch tiến độ — vì dữ liệu của họ nằm ở `path-progress-v1`, còn code mới đi
 * tìm `path-progress-v1:local-user`.
 *
 * Chỉ nhận lại cho khách: dữ liệu cũ trên máy này chắc chắn là của người dùng
 * chưa đăng nhập, không được phép gán cho một tài khoản vừa đăng nhập vào.
 */
export function readWithLegacyFallback(
  prefix: string,
  legacyKey: string
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const scoped = localStorage.getItem(scopedKey(prefix));
    if (scoped !== null) return scoped;

    if (activeUserId !== DEFAULT_USER_ID) return null;

    const legacy = localStorage.getItem(legacyKey);
    if (legacy === null) return null;

    // Chuyển sang khoá mới rồi mới trả về, để lần sau đọc thẳng.
    localStorage.setItem(scopedKey(prefix), legacy);
    localStorage.removeItem(legacyKey);
    return legacy;
  } catch {
    return null;
  }
}
