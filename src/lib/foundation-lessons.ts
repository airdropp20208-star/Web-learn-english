/**
 * Chặng −1 — Vỡ lòng: logic tiếng Anh.
 *
 * Dành cho người CHƯA BIẾT GÌ: chưa biết "động từ" hay "thì" là gì.
 * Nguyên tắc biên soạn:
 *   1. Giải thích bằng tiếng Việt trước.
 *   2. Chỉ ra chỗ tiếng Anh làm KHÁC tiếng Việt (đây là chỗ người Việt sai).
 *   3. Mới đưa từ tiếng Anh vào.
 *   4. Không dùng thuật ngữ nào chưa được giải thích ở bài trước.
 */

export type FoundationExercise =
  | {
      kind: "choice";
      question: string;
      options: string[];
      answerIndex: number;
      explain: string;
    }
  | {
      kind: "order";
      question: string;
      /** Các mảnh chữ sẽ được xáo trộn cho người học ghép lại. */
      tokens: string[];
      /** Câu đúng, các mảnh nối bằng dấu cách. */
      answer: string;
      explain: string;
    }
  | {
      kind: "fill";
      question: string;
      answer: string;
      /** Các đáp án khác cũng được chấp nhận. */
      accept?: string[];
      explain: string;
    };

export interface ContrastRow {
  vi: string;
  en: string;
  note: string;
}

export interface FoundationLesson {
  id: string;
  index: number;
  title: string;
  /** Học xong bài này thì làm được gì. */
  goal: string;
  /** Phần lý thuyết, mỗi phần tử là một đoạn. */
  theory: string[];
  /** Bảng đối chiếu Việt – Anh (không bắt buộc). */
  contrast?: ContrastRow[];
  exercises: FoundationExercise[];
}

export const FOUNDATION_LESSONS: FoundationLesson[] = [
  {
    id: "f01-cau-la-gi",
    index: 1,
    title: "Một câu gồm những gì?",
    goal: "Nhìn một câu và chỉ ra được: AI làm gì, làm cái gì.",
    theory: [
      "Mọi câu bình thường đều trả lời ba câu hỏi: AI? – LÀM GÌ? – (CÁI GÌ?)",
      "Ví dụ tiếng Việt: \"Tôi ăn cơm\". AI = tôi. LÀM GÌ = ăn. CÁI GÌ = cơm.",
      "Tiếng Anh xếp y hệt thứ tự đó: I eat rice. (I = tôi, eat = ăn, rice = cơm)",
      "Khác biệt quan trọng: tiếng Việt có thể đảo hoặc bỏ bớt, tiếng Anh thì KHÔNG. Thứ tự AI → LÀM GÌ → CÁI GÌ gần như là luật cứng.",
    ],
    contrast: [
      { vi: "Tôi ăn cơm", en: "I eat rice", note: "Cùng thứ tự" },
      { vi: "Cô ấy đọc sách", en: "She reads a book", note: "Cùng thứ tự" },
      { vi: "Cơm, tôi ăn rồi", en: "(không nói vậy)", note: "Tiếng Anh không đảo được" },
    ],
    exercises: [
      {
        kind: "choice",
        question: "Trong câu \"Tôi uống nước\", đâu là phần trả lời câu hỏi LÀM GÌ?",
        options: ["Tôi", "uống", "nước"],
        answerIndex: 1,
        explain: "\"Uống\" là hành động, tức phần trả lời LÀM GÌ.",
      },
      {
        kind: "choice",
        question: "Trong câu \"She reads a book\", đâu là phần AI?",
        options: ["She", "reads", "a book"],
        answerIndex: 0,
        explain: "She = cô ấy, là người thực hiện hành động.",
      },
      {
        kind: "order",
        question: "Ghép thành câu đúng: tôi ăn cơm",
        tokens: ["I", "eat", "rice"],
        answer: "I eat rice",
        explain: "AI (I) → LÀM GÌ (eat) → CÁI GÌ (rice).",
      },
      {
        kind: "order",
        question: "Ghép thành câu đúng: cô ấy thích cà phê",
        tokens: ["She", "likes", "coffee"],
        answer: "She likes coffee",
        explain: "Vẫn đúng thứ tự AI → LÀM GÌ → CÁI GÌ.",
      },
      {
        kind: "choice",
        question: "Câu nào xếp đúng thứ tự tiếng Anh?",
        options: ["Rice I eat", "I rice eat", "I eat rice"],
        answerIndex: 2,
        explain: "Tiếng Anh bắt buộc AI đứng đầu, rồi mới tới hành động.",
      },
    ],
  },
  {
    id: "f02-danh-tu",
    index: 2,
    title: "Danh từ — tên gọi của sự vật",
    goal: "Nhận ra đâu là danh từ trong câu.",
    theory: [
      "Danh từ là TÊN GỌI của một người, một vật, một nơi chốn.",
      "Tiếng Việt: cơm, mẹ, Hà Nội, cái bàn, tình yêu. Tiếng Anh: rice, mother, Hanoi, table, love.",
      "Trong câu, danh từ thường đóng vai AI (đứng đầu) hoặc CÁI GÌ (đứng cuối).",
      "Mẹo nhận biết: nếu đặt được chữ \"cái / con / người\" ở trước, hoặc chỉ được vào nó, thì đó là danh từ.",
    ],
    exercises: [
      {
        kind: "choice",
        question: "Từ nào là danh từ?",
        options: ["eat", "table", "happy"],
        answerIndex: 1,
        explain: "table = cái bàn, là tên một đồ vật.",
      },
      {
        kind: "choice",
        question: "Từ nào KHÔNG phải danh từ?",
        options: ["water", "school", "run"],
        answerIndex: 2,
        explain: "run = chạy, đó là hành động chứ không phải tên sự vật.",
      },
      {
        kind: "choice",
        question: "Trong câu \"I drink water\", danh từ đóng vai CÁI GÌ là từ nào?",
        options: ["I", "drink", "water"],
        answerIndex: 2,
        explain: "water = nước, là thứ bị uống.",
      },
      {
        kind: "choice",
        question: "\"mother\" nghĩa là gì?",
        options: ["bố", "mẹ", "bạn"],
        answerIndex: 1,
        explain: "mother = mẹ. (father = bố, friend = bạn)",
      },
      {
        kind: "choice",
        question: "Câu \"Hanoi is big\" có mấy danh từ?",
        options: ["0", "1", "2"],
        answerIndex: 1,
        explain: "Chỉ có Hanoi (tên một nơi chốn). \"big\" là từ mô tả, không phải danh từ.",
      },
    ],
  },
  {
    id: "f03-dong-tu",
    index: 3,
    title: "Động từ — hành động hoặc trạng thái",
    goal: "Chỉ ra được động từ trong câu. Đây là khái niệm quan trọng nhất.",
    theory: [
      "Động từ là phần trả lời câu hỏi LÀM GÌ.",
      "Có hai loại: hành động (ăn, đi, chạy, đọc) và trạng thái (thích, biết, muốn, là).",
      "Tiếng Anh: eat, go, run, read, like, know, want, be.",
      "LUẬT CỨNG: mỗi câu tiếng Anh BẮT BUỘC phải có đúng một động từ chính. Tiếng Việt thì không — \"Tôi mệt\" không có động từ nào cũng vẫn là câu đúng, nhưng tiếng Anh phải là \"I am tired\", không được bỏ chữ am.",
      "Nhớ được luật này là bạn tránh được lỗi phổ biến nhất của người Việt học tiếng Anh.",
    ],
    contrast: [
      { vi: "Tôi mệt", en: "I am tired", note: "Tiếng Anh phải thêm am" },
      { vi: "Cô ấy là giáo viên", en: "She is a teacher", note: "is = là" },
      { vi: "Tôi đi học", en: "I go to school", note: "go là động từ" },
    ],
    exercises: [
      {
        kind: "choice",
        question: "Từ nào là động từ?",
        options: ["book", "read", "small"],
        answerIndex: 1,
        explain: "read = đọc, là một hành động.",
      },
      {
        kind: "choice",
        question: "Trong câu \"They sleep at ten\", động từ là từ nào?",
        options: ["They", "sleep", "ten"],
        answerIndex: 1,
        explain: "sleep = ngủ.",
      },
      {
        kind: "choice",
        question: "Câu nào SAI vì thiếu động từ?",
        options: ["I am hungry", "I hungry", "I feel hungry"],
        answerIndex: 1,
        explain: "\"I hungry\" thiếu động từ. Phải là \"I am hungry\".",
      },
      {
        kind: "choice",
        question: "\"want\" nghĩa là gì?",
        options: ["cần", "muốn", "thích"],
        answerIndex: 1,
        explain: "want = muốn. (need = cần, like = thích)",
      },
      {
        kind: "order",
        question: "Ghép thành câu đúng: tôi muốn nước",
        tokens: ["I", "want", "water"],
        answer: "I want water",
        explain: "want là động từ, đứng ngay sau AI.",
      },
    ],
  },
  {
    id: "f04-tinh-tu",
    index: 4,
    title: "Tính từ — mô tả tính chất",
    goal: "Nhận ra tính từ và biết nó khác danh từ, động từ ở chỗ nào.",
    theory: [
      "Tính từ trả lời câu hỏi THẾ NÀO: to, nhỏ, ngon, mệt, mới, cũ.",
      "Tiếng Anh: big, small, delicious, tired, new, old.",
      "Tính từ không phải hành động, nên nó KHÔNG thay thế được động từ. Vì vậy khi nói \"Tôi mệt\" vẫn phải mượn động từ am: I am tired.",
      "Ba loại từ đã học: danh từ = tên gọi, động từ = hành động, tính từ = tính chất.",
    ],
    exercises: [
      {
        kind: "choice",
        question: "Từ nào là tính từ?",
        options: ["happy", "house", "go"],
        answerIndex: 0,
        explain: "happy = vui, mô tả tính chất.",
      },
      {
        kind: "choice",
        question: "\"cold\" nghĩa là gì?",
        options: ["nóng", "lạnh", "cũ"],
        answerIndex: 1,
        explain: "cold = lạnh. (hot = nóng, old = cũ)",
      },
      {
        kind: "choice",
        question: "Trong \"She is tired\", từ nào là tính từ?",
        options: ["She", "is", "tired"],
        answerIndex: 2,
        explain: "tired = mệt. \"is\" là động từ, \"She\" là AI.",
      },
      {
        kind: "choice",
        question: "Xếp loại từ \"water\":",
        options: ["danh từ", "động từ", "tính từ"],
        answerIndex: 0,
        explain: "water = nước, là tên một sự vật.",
      },
      {
        kind: "choice",
        question: "Xếp loại từ \"small\":",
        options: ["danh từ", "động từ", "tính từ"],
        answerIndex: 2,
        explain: "small = nhỏ, mô tả tính chất.",
      },
    ],
  },
  {
    id: "f05-trat-tu-tu",
    index: 5,
    title: "Trật tự từ — chỗ người Việt sai nhiều nhất",
    goal: "Đặt tính từ đúng chỗ và không dịch word-by-word từ tiếng Việt.",
    theory: [
      "Tiếng Việt đặt tính từ SAU danh từ: cái áo đỏ, con mèo to.",
      "Tiếng Anh đặt tính từ TRƯỚC danh từ: a red shirt, a big cat.",
      "Đây là lỗi kinh điển: nhiều người nói \"a shirt red\" vì dịch thẳng từ tiếng Việt. Sai.",
      "Quy tắc để nhớ: trong tiếng Anh, thứ mô tả luôn đi trước thứ bị mô tả.",
    ],
    contrast: [
      { vi: "cái áo đỏ", en: "a red shirt", note: "Tính từ đứng TRƯỚC" },
      { vi: "ngôi nhà to", en: "a big house", note: "Tính từ đứng TRƯỚC" },
      { vi: "quyển sách mới", en: "a new book", note: "Tính từ đứng TRƯỚC" },
    ],
    exercises: [
      {
        kind: "choice",
        question: "\"cái áo đỏ\" dịch đúng là:",
        options: ["a shirt red", "a red shirt", "red a shirt"],
        answerIndex: 1,
        explain: "Tính từ (red) đứng trước danh từ (shirt).",
      },
      {
        kind: "order",
        question: "Ghép thành cụm đúng: một ngôi nhà to",
        tokens: ["a", "big", "house"],
        answer: "a big house",
        explain: "a → big (tính từ) → house (danh từ).",
      },
      {
        kind: "order",
        question: "Ghép thành câu đúng: tôi có một quyển sách mới",
        tokens: ["I", "have", "a", "new", "book"],
        answer: "I have a new book",
        explain: "AI → động từ → cụm danh từ (tính từ trước danh từ).",
      },
      {
        kind: "choice",
        question: "Câu nào SAI?",
        options: ["a small room", "a room small", "a cold night"],
        answerIndex: 1,
        explain: "\"a room small\" là dịch thẳng kiểu tiếng Việt, sai trật tự.",
      },
      {
        kind: "order",
        question: "Ghép thành câu đúng: cô ấy là một người bạn tốt",
        tokens: ["She", "is", "a", "good", "friend"],
        answer: "She is a good friend",
        explain: "good (tính từ) đứng trước friend (danh từ).",
      },
    ],
  },
  {
    id: "f06-so-nhieu-mao-tu",
    index: 6,
    title: "Một hay nhiều, và a / an / the",
    goal: "Biết khi nào thêm -s và khi nào dùng a, an, the.",
    theory: [
      "Tiếng Việt nói \"con mèo\" cho cả một con lẫn nhiều con — người nghe tự hiểu.",
      "Tiếng Anh BẮT BUỘC phân biệt. Nhiều hơn một thì thêm -s: cat → cats, book → books.",
      "Trước danh từ số ít thường phải có a hoặc the:",
      "• a cat = một con mèo bất kỳ (người nghe chưa biết là con nào)",
      "• the cat = đúng con mèo đó (cả hai đều biết đang nói con nào)",
      "• cats = mèo nói chung",
      "Dùng an thay cho a khi từ sau bắt đầu bằng âm nguyên âm: an apple, an hour.",
      "Quên a / the là lỗi phổ biến nhất của người Việt, vì tiếng Việt không có khái niệm này.",
    ],
    contrast: [
      { vi: "Tôi có một con mèo", en: "I have a cat", note: "Con nào cũng được" },
      { vi: "Con mèo đang ngủ", en: "The cat is sleeping", note: "Đúng con đã nhắc tới" },
      { vi: "Tôi thích mèo", en: "I like cats", note: "Nói chung → thêm -s" },
    ],
    exercises: [
      {
        kind: "fill",
        question: "Điền a hoặc an: I have ___ book.",
        answer: "a",
        explain: "book bắt đầu bằng phụ âm nên dùng a.",
      },
      {
        kind: "fill",
        question: "Điền a hoặc an: She eats ___ apple.",
        answer: "an",
        explain: "apple bắt đầu bằng âm nguyên âm nên dùng an.",
      },
      {
        kind: "choice",
        question: "\"Tôi thích mèo\" (nói chung) dịch đúng là:",
        options: ["I like a cat", "I like cats", "I like the cat"],
        answerIndex: 1,
        explain: "Nói chung về loài thì dùng số nhiều: cats.",
      },
      {
        kind: "choice",
        question: "Số nhiều của \"book\" là:",
        options: ["bookes", "books", "book"],
        answerIndex: 1,
        explain: "Đa số danh từ chỉ cần thêm -s.",
      },
      {
        kind: "choice",
        question: "Câu nào SAI?",
        options: ["I have a car", "I have car", "I have two cars"],
        answerIndex: 1,
        explain: "Danh từ số ít không được đứng trần, phải có a hoặc the.",
      },
    ],
  },
  {
    id: "f07-thi-la-gi",
    index: 7,
    title: "\"Thì\" là gì?",
    goal: "Hiểu khái niệm thì và nhận ra 4 thì cơ bản.",
    theory: [
      "Thì chỉ đơn giản là cách câu cho biết việc xảy ra LÚC NÀO.",
      "Tiếng Việt báo thời gian bằng cách THÊM CHỮ: đã / đang / sẽ. Bản thân động từ không đổi.",
      "Tiếng Anh báo thời gian bằng cách ĐỔI CHÍNH ĐỘNG TỪ.",
      "Hiểu đúng một câu đó là bạn đã hiểu 80% khái niệm \"thì\". Phần còn lại chỉ là học thuộc dạng của từng động từ.",
      "Lưu ý: một số động từ đổi dạng bất quy tắc, phải học thuộc: eat → ate, go → went, see → saw.",
    ],
    contrast: [
      { vi: "Tôi đã ăn", en: "I ate", note: "Quá khứ — đổi eat thành ate" },
      { vi: "Tôi ăn", en: "I eat", note: "Hiện tại, thói quen" },
      { vi: "Tôi đang ăn", en: "I am eating", note: "Đang xảy ra — am + đuôi -ing" },
      { vi: "Tôi sẽ ăn", en: "I will eat", note: "Tương lai — thêm will" },
    ],
    exercises: [
      {
        kind: "choice",
        question: "\"Tôi sẽ đi\" dịch là:",
        options: ["I go", "I went", "I will go"],
        answerIndex: 2,
        explain: "Tương lai dùng will + động từ nguyên dạng.",
      },
      {
        kind: "choice",
        question: "\"I am reading\" nghĩa là:",
        options: ["Tôi đã đọc", "Tôi đang đọc", "Tôi sẽ đọc"],
        answerIndex: 1,
        explain: "am + đuôi -ing = việc đang diễn ra ngay lúc này.",
      },
      {
        kind: "choice",
        question: "Dạng quá khứ của \"go\" là:",
        options: ["goed", "went", "gone"],
        answerIndex: 1,
        explain: "go là động từ bất quy tắc: go → went.",
      },
      {
        kind: "choice",
        question: "\"Cô ấy đã mua một cái điện thoại\" dịch là:",
        options: [
          "She buys a phone",
          "She bought a phone",
          "She will buy a phone",
        ],
        answerIndex: 1,
        explain: "buy → bought (quá khứ).",
      },
      {
        kind: "choice",
        question: "Điểm khác nhau cốt lõi giữa tiếng Việt và tiếng Anh khi nói về thời gian là:",
        options: [
          "Tiếng Anh thêm chữ, tiếng Việt đổi động từ",
          "Tiếng Việt thêm chữ (đã/đang/sẽ), tiếng Anh đổi chính động từ",
          "Cả hai đều đổi động từ",
        ],
        answerIndex: 1,
        explain: "Đây là ý quan trọng nhất của cả bài.",
      },
    ],
  },
  {
    id: "f08-to-be",
    index: 8,
    title: "Động từ to be (am / is / are)",
    goal: "Dùng đúng am, is, are — động từ hay dùng nhất tiếng Anh.",
    theory: [
      "Dùng to be khi câu KHÔNG có hành động, mà chỉ nói \"ai LÀ gì\" hoặc \"ai THẾ NÀO\".",
      "Chia theo AI: I → am. He / She / It → is. You / We / They → are.",
      "Ví dụ: I am a student. She is tired. They are at home.",
      "Tiếng Việt bỏ được chữ \"là\" khi nói \"Tôi mệt\", nhưng tiếng Anh KHÔNG được bỏ am.",
      "Cách nói tắt thường gặp: I am → I'm, She is → She's, They are → They're.",
    ],
    exercises: [
      {
        kind: "fill",
        question: "Điền am / is / are: I ___ a student.",
        answer: "am",
        explain: "I luôn đi với am.",
      },
      {
        kind: "fill",
        question: "Điền am / is / are: She ___ my mother.",
        answer: "is",
        explain: "He / She / It đi với is.",
      },
      {
        kind: "fill",
        question: "Điền am / is / are: They ___ hungry.",
        answer: "are",
        explain: "You / We / They đi với are.",
      },
      {
        kind: "choice",
        question: "\"Tôi mệt\" dịch đúng là:",
        options: ["I tired", "I am tired", "I is tired"],
        answerIndex: 1,
        explain: "Không được bỏ am, và I không bao giờ đi với is.",
      },
      {
        kind: "order",
        question: "Ghép thành câu đúng: chúng tôi là bạn",
        tokens: ["We", "are", "friends"],
        answer: "We are friends",
        explain: "We đi với are; friends ở số nhiều vì có nhiều người.",
      },
    ],
  },
  {
    id: "f09-phu-dinh-cau-hoi",
    index: 9,
    title: "Câu phủ định và câu hỏi",
    goal: "Nói \"tôi không...\" và hỏi \"bạn có... không?\" cho đúng.",
    theory: [
      "Tiếng Việt phủ định rất dễ: chỉ cần thêm chữ \"không\" trước động từ.",
      "Tiếng Anh phải MƯỢN động từ do: I do not like coffee. Nói tắt: I don't like coffee.",
      "Với he / she / it thì mượn does: She does not like coffee → She doesn't like coffee.",
      "Câu hỏi thì đảo do lên đầu: Do you like coffee? / Does she like coffee?",
      "Riêng to be thì dễ hơn nhiều, không cần mượn gì: I am not tired. / Are you tired?",
      "Lỗi hay gặp: nói \"I no like\" hoặc \"You like coffee?\". Cả hai đều sai.",
    ],
    contrast: [
      { vi: "Tôi không thích cà phê", en: "I don't like coffee", note: "Mượn do" },
      { vi: "Bạn có thích cà phê không?", en: "Do you like coffee?", note: "Do lên đầu" },
      { vi: "Tôi không mệt", en: "I am not tired", note: "to be thì chỉ thêm not" },
    ],
    exercises: [
      {
        kind: "choice",
        question: "\"Tôi không thích cà phê\" dịch đúng là:",
        options: ["I no like coffee", "I don't like coffee", "I not like coffee"],
        answerIndex: 1,
        explain: "Phải mượn do: do not = don't.",
      },
      {
        kind: "order",
        question: "Ghép thành câu hỏi: bạn có nói tiếng Anh không?",
        tokens: ["Do", "you", "speak", "English"],
        answer: "Do you speak English",
        explain: "Câu hỏi đảo Do lên đầu.",
      },
      {
        kind: "choice",
        question: "Câu hỏi đúng với \"she\" là:",
        options: ["Do she like tea?", "Does she like tea?", "She does like tea?"],
        answerIndex: 1,
        explain: "He / she / it dùng does.",
      },
      {
        kind: "choice",
        question: "\"Tôi không mệt\" dịch đúng là:",
        options: ["I don't tired", "I am not tired", "I not am tired"],
        answerIndex: 1,
        explain: "Câu có to be thì chỉ cần thêm not sau am, không mượn do.",
      },
      {
        kind: "order",
        question: "Ghép thành câu đúng: bạn có mệt không?",
        tokens: ["Are", "you", "tired"],
        answer: "Are you tired",
        explain: "Với to be, chỉ cần đảo are lên đầu.",
      },
    ],
  },
  {
    id: "f10-dai-tu-them-s",
    index: 10,
    title: "Đại từ và luật thêm -s",
    goal: "Chia động từ đúng với he / she / it. Hoàn tất Chặng −1.",
    theory: [
      "Bảy đại từ cần thuộc: I (tôi), you (bạn), he (anh ấy), she (cô ấy), it (nó), we (chúng tôi), they (họ).",
      "Luật: ở thì hiện tại, khi AI là he / she / it thì động từ phải THÊM -s.",
      "I eat → He eats. I like → She likes. I go → It goes.",
      "Nghe vô lý nhưng đây là luật bắt buộc, và là lỗi bị bắt nhiều nhất khi nói.",
      "Mẹo nhớ: \"he, she, it — nhớ thêm s\".",
    ],
    exercises: [
      {
        kind: "fill",
        question: "Điền dạng đúng của động từ eat: She ___ rice.",
        answer: "eats",
        explain: "she → động từ thêm -s.",
      },
      {
        kind: "fill",
        question: "Điền dạng đúng của động từ work: They ___ at home.",
        answer: "work",
        explain: "they không thuộc nhóm he/she/it nên giữ nguyên.",
      },
      {
        kind: "choice",
        question: "Câu nào ĐÚNG?",
        options: ["He like coffee", "He likes coffee", "He liking coffee"],
        answerIndex: 1,
        explain: "he → likes.",
      },
      {
        kind: "order",
        question: "Ghép thành câu đúng: cô ấy sống ở Việt Nam",
        tokens: ["She", "lives", "in", "Vietnam"],
        answer: "She lives in Vietnam",
        explain: "live + s = lives vì AI là she.",
      },
      {
        kind: "choice",
        question: "Đại từ nào KHÔNG cần thêm -s cho động từ?",
        options: ["he", "it", "we"],
        answerIndex: 2,
        explain: "Chỉ he / she / it mới thêm -s.",
      },
    ],
  },
];

export function getFoundationLesson(id: string): FoundationLesson | undefined {
  return FOUNDATION_LESSONS.find((l) => l.id === id);
}

export const FOUNDATION_LESSON_COUNT = FOUNDATION_LESSONS.length;
