// Phát âm một từ: ưu tiên file audio thật, không có thì nhờ giọng đọc của
// trình duyệt.

/**
 * Đọc văn bản bằng bộ tổng hợp giọng nói của trình duyệt.
 *
 * Trả về `false` khi trình duyệt không hỗ trợ (Firefox trên một số bản Linux,
 * WebView bị gỡ TTS) để nơi gọi còn biết mà báo người dùng, thay vì im lặng.
 */
export function speakText(text: string): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

/**
 * Phát âm một từ.
 *
 * `audio.play()` trả về Promise và trình duyệt SẼ từ chối nó khi chặn autoplay
 * hoặc khi URL hỏng. Bỏ quên Promise đó là để lỗi rơi ra ngoài dưới dạng
 * unhandled rejection — người dùng thấy nút bấm không kêu mà không hiểu vì sao.
 * Ở đây bắt lại và lùi về giọng đọc trình duyệt.
 */
export async function pronounce(
  word: string,
  audioUrl?: string | null
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (audioUrl) {
    try {
      await new Audio(audioUrl).play();
      return true;
    } catch {
      // rơi xuống giọng đọc trình duyệt bên dưới
    }
  }
  return speakText(word);
}
