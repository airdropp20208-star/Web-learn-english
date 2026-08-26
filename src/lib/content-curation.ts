/**
 * Chấm điểm từ đáng học và gợi ý bài đọc hợp trình độ.
 *
 * Bản trước dùng một bảng tần suất viết tay 40 từ, nên mọi từ ngoài bảng đều
 * nhận cùng một điểm 3/10 — tức là xếp hạng gì cũng gần như ngẫu nhiên. Giờ
 * đọc thẳng trục CEFR thật ở `public/data/words.json` (4.298 mục, cùng file
 * `/api/analyze` đang dùng phía máy chủ).
 */

import type { CEFRLevel, TextDTO } from "./types";

export interface WordFacts {
  cefr: CEFRLevel;
  /** log10 tần suất tương đối. Càng gần 0 càng phổ biến; `null` là không có số liệu. */
  freq: number | null;
}

export type CefrSpine = Map<string, WordFacts>;

export const CEFR_ORDER: readonly CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

function bacCefr(level: CEFRLevel): number {
  const i = CEFR_ORDER.indexOf(level);
  return i === -1 ? 0 : i;
}

// ============ Nạp trục CEFR ============

let yeuCauSpine: Promise<CefrSpine> | null = null;

/**
 * Nạp trục CEFR từ `/data/words.json`, dùng chung một lần cho cả phiên.
 *
 * File nặng ~210 KB nên chỉ tải khi thật sự cần (mở tab Thư viện), và giữ lại
 * ở cấp module để không tải lại mỗi lần đổi tab. Hỏng thì xoá cache đi để lần
 * sau còn thử lại được — giữ một Promise đã reject sẽ khoá vĩnh viễn tính năng
 * chỉ vì một lần mất mạng.
 */
export function loadCefrSpine(): Promise<CefrSpine> {
  if (!yeuCauSpine) {
    yeuCauSpine = fetch("/data/words.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Không tải được trục CEFR (${res.status})`);
        return res.json();
      })
      .then((rows: Array<{ w: string; c: CEFRLevel; f: number | null }>) => {
        const spine: CefrSpine = new Map();
        for (const r of rows) spine.set(r.w, { cefr: r.c, freq: r.f });
        return spine;
      })
      .catch((err) => {
        yeuCauSpine = null;
        throw err;
      });
  }
  return yeuCauSpine;
}

// ============ Chấm điểm từ ============

/** Ngưỡng tần suất tương ứng điểm 10 (cỡ từ "the"). */
const FREQ_PHO_BIEN = -3;
/** Ngưỡng tương ứng điểm 1 — dưới mức này coi như hiếm ngang nhau. */
const FREQ_HIEM = -7;

/**
 * Độ phổ biến của một từ, thang 1–10 (10 = hay gặp nhất).
 *
 * Từ không có trong trục trả 3 — cùng giá trị mặc định như bản cũ. Đa số
 * trường hợp đó là tên riêng, từ viết sai, hoặc từ quá hiếm; cho điểm giữa
 * thấp để chúng không chen lên đầu bảng nhưng cũng không biến mất hẳn.
 */
export function getCEFRFrequency(word: string, spine: CefrSpine): number {
  const facts = spine.get(word.toLowerCase());
  if (!facts || facts.freq === null) return 3;
  const t = (facts.freq - FREQ_HIEM) / (FREQ_PHO_BIEN - FREQ_HIEM);
  return Math.min(10, Math.max(1, Math.round(t * 9) + 1));
}

/** Số lần từ này xuất hiện trong các bài người dùng đã đọc. */
export function countOccurrences(word: string, history: TextDTO[]): number {
  const lower = word.toLowerCase();
  let count = 0;
  for (const text of history) {
    const tokens = text.content.toLowerCase().split(/\W+/);
    count += tokens.filter((t) => t === lower).length;
  }
  return count;
}

/**
 * Độ quan trọng của một từ với riêng người này: phổ biến trong tiếng Anh nói
 * chung, cộng thêm trọng số nếu chính họ đã gặp nó nhiều lần.
 *
 * Gặp lại là tín hiệu mạnh hơn tần suất chung — một từ chuyên ngành hiếm
 * nhưng lặp ba lần trong tài liệu họ đang đọc thì đáng học hơn một từ phổ
 * thông họ chưa gặp bao giờ.
 */
export function rankWordRelevance(
  word: string,
  userHistory: TextDTO[],
  spine: CefrSpine
): number {
  const corpusFreq = getCEFRFrequency(word, spine);
  const personalFreq = countOccurrences(word, userHistory);
  return personalFreq > 0 ? personalFreq * 2 + corpusFreq : corpusFreq;
}

export interface WorthLearning {
  word: string;
  score: number;
  cefr: CEFRLevel;
}

/**
 * Rút những từ đáng học nhất trong một đoạn văn.
 *
 * "Đáng học" ở đây có ba điều kiện, và bỏ điều kiện nào cũng ra danh sách vô
 * dụng: từ phải nằm trong trục CEFR (loại tên riêng và lỗi chính tả), phải
 * chưa có trong sổ từ của người dùng (học lại cái đã biết là phí), và phải
 * không thấp hơn trình độ hiện tại quá một bậc (một người B2 không cần được
 * nhắc từ "the").
 */
export function pickTopWords(
  content: string,
  userHistory: TextDTO[],
  known: Set<string>,
  spine: CefrSpine,
  userLevel: CEFRLevel = "A1",
  topN: number = 8
): WorthLearning[] {
  const sanTrinhDo = Math.max(0, bacCefr(userLevel) - 1);
  const tokens = Array.from(
    new Set(
      content
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2)
    )
  );

  const ungVien: WorthLearning[] = [];
  for (const word of tokens) {
    if (known.has(word)) continue;
    const facts = spine.get(word);
    if (!facts) continue;
    if (bacCefr(facts.cefr) < sanTrinhDo) continue;
    ungVien.push({
      word,
      score: rankWordRelevance(word, userHistory, spine),
      cefr: facts.cefr,
    });
  }

  return ungVien.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word)).slice(0, topN);
}

// ============ Gợi ý bài đọc ============

/**
 * Đoán trình độ người dùng từ những bài họ đã đọc.
 *
 * Lấy trung vị chứ không lấy trung bình: một bài C2 đọc thử cho biết sẽ kéo
 * trung bình lên hẳn một bậc và làm mọi gợi ý sau đó quá khó.
 */
export function estimateUserLevel(
  history: TextDTO[],
  macDinh: CEFRLevel = "A2"
): CEFRLevel {
  if (history.length === 0) return macDinh;
  // Chỉ nhìn 10 bài gần nhất — trình độ tháng trước không nói gì về hôm nay.
  const ganDay = [...history].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
  const bacs = ganDay.map((t) => bacCefr(t.cefrLevel)).sort((a, b) => a - b);
  const giua = bacs[Math.floor(bacs.length / 2)];
  return CEFR_ORDER[giua];
}

export interface TextCandidate {
  id: string;
  title: string;
  content: string;
  level: CEFRLevel;
}

export interface TextSuggestion<T extends TextCandidate> {
  text: T;
  score: number;
  /** Số từ đáng học có trong bài mà người dùng chưa lưu. */
  newWords: number;
  /** Câu giải thích ngắn để hiện dưới thẻ gợi ý. */
  reason: string;
}

/**
 * Điểm cho khoảng cách giữa trình độ bài và trình độ người đọc.
 *
 * Cao nhất là bài trên một bậc: đủ khó để học được cái mới, chưa khó tới mức
 * phải tra từ điển từng câu. Bài đúng trình độ đứng thứ hai, dễ hơn hoặc khó
 * hơn hai bậc thì gần như không có tác dụng.
 */
function diemMucDo(chenhLech: number): number {
  if (chenhLech === 1) return 5;
  if (chenhLech === 0) return 4;
  if (chenhLech === -1) return 2;
  if (chenhLech === 2) return 2;
  return 0;
}

function moTaMucDo(chenhLech: number): string {
  if (chenhLech === 1) return "Cao hơn trình độ của bạn một bậc";
  if (chenhLech === 0) return "Đúng trình độ của bạn";
  if (chenhLech === -1) return "Dễ hơn một bậc, hợp để đọc nhanh";
  if (chenhLech > 1) return "Khó hơn hẳn, đọc thử nếu muốn thử thách";
  return "Dễ hơn nhiều so với trình độ của bạn";
}

export function suggestTexts<T extends TextCandidate>(opts: {
  candidates: T[];
  history: TextDTO[];
  known: Set<string>;
  spine: CefrSpine;
  userLevel: CEFRLevel;
  limit?: number;
}): Array<TextSuggestion<T>> {
  const { candidates, history, known, spine, userLevel, limit = 3 } = opts;
  const bacNguoiDoc = bacCefr(userLevel);

  // Bài đã nhập vào thư viện cá nhân rồi thì đừng gợi ý lại.
  const daDoc = new Set(history.map((t) => t.title.trim().toLowerCase()));

  const ketQua: Array<TextSuggestion<T>> = [];
  for (const c of candidates) {
    if (daDoc.has(c.title.trim().toLowerCase())) continue;

    const chenhLech = bacCefr(c.level) - bacNguoiDoc;
    const diemMuc = diemMucDo(chenhLech);
    if (diemMuc === 0) continue;

    const tuDangHoc = pickTopWords(c.content, history, known, spine, userLevel, 999);
    const newWords = tuDangHoc.length;

    // Trần 24: quá ngưỡng đó thì bài nào cũng "nhiều từ mới", số lượng thôi
    // không còn phân biệt được bài nào hợp hơn — để mức độ quyết định.
    const score = diemMuc * 2 + Math.min(newWords, 24) / 6;

    ketQua.push({
      text: c,
      score,
      newWords,
      reason:
        newWords > 0
          ? `${moTaMucDo(chenhLech)} · ${newWords} từ đáng học`
          : `${moTaMucDo(chenhLech)} · bạn đã biết gần hết từ trong bài`,
    });
  }

  return ketQua
    .sort((a, b) => b.score - a.score || a.text.title.localeCompare(b.text.title))
    .slice(0, limit);
}
