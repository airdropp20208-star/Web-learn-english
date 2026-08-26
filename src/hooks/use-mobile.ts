import * as React from "react"

const MOBILE_BREAKPOINT = 768

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Kích thước màn hình là kho dữ liệu NGOÀI React, nên đọc bằng
 * `useSyncExternalStore` chứ không phải `useEffect` + `setState`.
 *
 * Bản cũ khởi tạo `undefined` rồi setState ngay trong effect: mỗi lần gắn
 * component đều tốn thêm một vòng vẽ, và trong vòng đầu mọi thứ đều tưởng là
 * desktop — thanh điều hướng dưới nháy một nhịp trên điện thoại.
 */
function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches
}

/**
 * Trên server không có màn hình nào để đo. Trả `false` (giả định desktop) để
 * HTML dựng sẵn khớp với lần vẽ hydrate đầu tiên; React sẽ tự sửa lại ngay sau
 * đó nếu thực tế là điện thoại.
 */
function getServerSnapshot(): boolean {
  return false
}

export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
