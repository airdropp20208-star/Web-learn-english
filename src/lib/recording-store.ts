/**
 * Kho bản ghi âm của phần luyện nói, đặt trong IndexedDB.
 *
 * Vì sao không nhét thẳng vào chỗ lưu phiên: một phút ghi âm webm nặng
 * khoảng 500 KB, mà `localStorage` chỉ có tổng cộng 5–10 MB cho cả tên miền
 * và chỉ nhận chuỗi — nhồi base64 vào đó là lấp đầy hạn mức chung của cả app
 * sau chừng mười phiên. IndexedDB nhận thẳng `Blob` và có hạn mức rộng hơn
 * hẳn.
 *
 * Điều cần nói rõ: **bản ghi nằm trên máy này, không đi theo tài khoản.**
 * `ShadowSessionDTO` được đồng bộ lên server, nhưng phần âm thanh thì không —
 * gửi file lên cần một kho blob (Vercel Blob hoặc S3) mà dự án chưa dựng. Nên
 * đăng nhập ở máy khác sẽ thấy lịch sử luyện nói mà không nghe lại được, và
 * giao diện phải nói thẳng điều đó thay vì đưa ra một nút bấm rồi không kêu.
 *
 * Trước đây chỗ này còn tệ hơn: mã cũ nhét `URL.createObjectURL(blob)` vào
 * `userRecordingUrl` rồi lưu. Blob URL chết ngay khi trang được tải lại, nên
 * mọi phiên trong lịch sử đều trỏ vào hư không — và chuỗi rác đó còn được
 * đồng bộ lên server.
 */

const DB_NAME = "web-learn-english";
const DB_VERSION = 1;
const STORE = "shadow-recordings";

/** Cờ ghi vào `userRecordingUrl` để đánh dấu "âm thanh nằm trong IndexedDB". */
export const LOCAL_RECORDING_MARKER = "idb";

/**
 * `false` khi chạy trên server, trong trình duyệt quá cũ, hoặc ở chế độ riêng
 * tư của một số trình duyệt (`indexedDB` có mặt nhưng `open()` ném lỗi).
 */
export function recordingStoreAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!recordingStoreAvailable()) {
      reject(new Error("Trình duyệt không có IndexedDB."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Không mở được IndexedDB."));
    // Xảy ra khi một tab khác đang giữ phiên bản DB cũ. Không tự ý đóng tab kia;
    // báo lỗi để phần gọi hiển thị thông báo thay vì treo mãi.
    req.onblocked = () =>
      reject(new Error("Một tab khác đang giữ cơ sở dữ liệu. Hãy đóng bớt tab."));
  });
}

/**
 * Chạy một giao dịch rồi luôn đóng kết nối.
 *
 * Bọc lại vì cả bốn hàm dưới đây đều lặp đúng khuôn này, và quên `db.close()`
 * một lần là lần nâng phiên bản sau bị chặn vô thời hạn.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error ?? new Error("Giao dịch IndexedDB thất bại."));
      tx.onabort = () => reject(tx.error ?? new Error("Giao dịch IndexedDB bị huỷ."));
    });
  } finally {
    db.close();
  }
}

export function saveRecording(sessionId: string, blob: Blob): Promise<void> {
  return withStore<void>("readwrite", (store) => store.put(blob, sessionId));
}

export async function loadRecording(sessionId: string): Promise<Blob | null> {
  const value = await withStore<Blob | undefined>("readonly", (store) =>
    store.get(sessionId)
  );
  return value ?? null;
}

export function deleteRecording(sessionId: string): Promise<void> {
  return withStore<void>("readwrite", (store) => store.delete(sessionId));
}

/**
 * Những phiên có bản ghi trên máy này.
 *
 * Lấy một lượt tất cả khoá thay vì hỏi từng phiên: lịch sử có thể dài, và mở
 * một kết nối IndexedDB cho mỗi dòng là chỗ dễ giật nhất của tab này.
 */
export async function listRecordedSessionIds(): Promise<Set<string>> {
  const keys = await withStore<IDBValidKey[]>("readonly", (store) => store.getAllKeys());
  return new Set(keys.map(String));
}
