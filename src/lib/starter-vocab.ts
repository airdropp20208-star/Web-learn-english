/**
 * Chặng 0 — 100 từ nền tảng.
 *
 * Đây là 100 từ xuất hiện nhiều nhất trong tiếng Anh giao tiếp hằng ngày,
 * chọn theo tinh thần của New General Service List (NGSL). Học thuộc nhóm này
 * là hiểu được khoảng một nửa số từ trong hội thoại thông thường.
 *
 * Mỗi từ đều có: nghĩa tiếng Việt, phiên âm IPA, một câu ví dụ ngắn và bản dịch
 * — vì học từ rời không có câu thì biết nghĩa cũng không đặt được câu.
 */

export interface StarterWord {
  en: string;
  vi: string;
  ipa: string;
  example: string;
  exampleVi: string;
  group: string;
}

type Row = [en: string, vi: string, ipa: string, ex: string, exVi: string];

const PRONOUNS: Row[] = [
  ["I", "tôi", "/aɪ/", "I am happy.", "Tôi vui."],
  ["you", "bạn", "/juː/", "You are my friend.", "Bạn là bạn của tôi."],
  ["he", "anh ấy", "/hiː/", "He is my brother.", "Anh ấy là anh trai tôi."],
  ["she", "cô ấy", "/ʃiː/", "She is a teacher.", "Cô ấy là giáo viên."],
  ["it", "nó", "/ɪt/", "It is a cat.", "Nó là một con mèo."],
  ["we", "chúng tôi", "/wiː/", "We are students.", "Chúng tôi là học sinh."],
  ["they", "họ", "/ðeɪ/", "They are at home.", "Họ đang ở nhà."],
];

const CORE_VERBS: Row[] = [
  ["be", "thì, là, ở", "/biː/", "I am a student.", "Tôi là học sinh."],
  ["have", "có", "/hæv/", "I have a book.", "Tôi có một quyển sách."],
  ["do", "làm", "/duː/", "I do my homework.", "Tôi làm bài tập."],
  ["go", "đi", "/ɡəʊ/", "I go to school.", "Tôi đi học."],
  ["come", "đến", "/kʌm/", "Come here, please.", "Đến đây đi."],
  ["want", "muốn", "/wɒnt/", "I want water.", "Tôi muốn nước."],
  ["need", "cần", "/niːd/", "I need help.", "Tôi cần giúp đỡ."],
  ["like", "thích", "/laɪk/", "I like coffee.", "Tôi thích cà phê."],
  ["love", "yêu", "/lʌv/", "I love my family.", "Tôi yêu gia đình tôi."],
  ["know", "biết", "/nəʊ/", "I know you.", "Tôi biết bạn."],
  ["think", "nghĩ", "/θɪŋk/", "I think so.", "Tôi nghĩ vậy."],
  ["see", "thấy", "/siː/", "I see a bird.", "Tôi thấy một con chim."],
  ["look", "nhìn", "/lʊk/", "Look at me.", "Nhìn tôi này."],
  ["hear", "nghe", "/hɪə/", "I hear music.", "Tôi nghe thấy nhạc."],
  ["say", "nói (điều gì)", "/seɪ/", "Say it again.", "Nói lại đi."],
  ["speak", "nói (ngôn ngữ)", "/spiːk/", "I speak English.", "Tôi nói tiếng Anh."],
  ["eat", "ăn", "/iːt/", "I eat rice.", "Tôi ăn cơm."],
  ["drink", "uống", "/drɪŋk/", "I drink water.", "Tôi uống nước."],
  ["sleep", "ngủ", "/sliːp/", "I sleep at ten.", "Tôi ngủ lúc mười giờ."],
  ["work", "làm việc", "/wɜːk/", "I work at home.", "Tôi làm việc ở nhà."],
  ["study", "học", "/ˈstʌdi/", "I study English.", "Tôi học tiếng Anh."],
  ["read", "đọc", "/riːd/", "I read a book.", "Tôi đọc một quyển sách."],
  ["write", "viết", "/raɪt/", "I write my name.", "Tôi viết tên tôi."],
  ["buy", "mua", "/baɪ/", "I buy a shirt.", "Tôi mua một cái áo."],
  ["give", "cho", "/ɡɪv/", "Give me the book.", "Đưa tôi quyển sách."],
  ["take", "lấy, cầm", "/teɪk/", "Take this.", "Cầm cái này đi."],
  ["make", "làm ra", "/meɪk/", "I make coffee.", "Tôi pha cà phê."],
  ["get", "nhận được", "/ɡet/", "I get a gift.", "Tôi nhận được một món quà."],
  ["put", "đặt", "/pʊt/", "Put it here.", "Đặt nó ở đây."],
  ["open", "mở", "/ˈəʊpən/", "Open the door.", "Mở cửa đi."],
  ["close", "đóng", "/kləʊz/", "Close the window.", "Đóng cửa sổ lại."],
  ["help", "giúp", "/help/", "Help me, please.", "Làm ơn giúp tôi."],
  ["live", "sống", "/lɪv/", "I live in Vietnam.", "Tôi sống ở Việt Nam."],
];

const PEOPLE: Row[] = [
  ["man", "người đàn ông", "/mæn/", "That man is tall.", "Người đàn ông đó cao."],
  ["woman", "người phụ nữ", "/ˈwʊmən/", "The woman is my boss.", "Người phụ nữ đó là sếp tôi."],
  ["boy", "cậu bé", "/bɔɪ/", "The boy is happy.", "Cậu bé đang vui."],
  ["girl", "cô bé", "/ɡɜːl/", "The girl reads a book.", "Cô bé đọc sách."],
  ["friend", "bạn", "/frend/", "He is my friend.", "Anh ấy là bạn tôi."],
  ["family", "gia đình", "/ˈfæməli/", "I love my family.", "Tôi yêu gia đình tôi."],
  ["mother", "mẹ", "/ˈmʌðə/", "My mother is kind.", "Mẹ tôi hiền."],
  ["father", "bố", "/ˈfɑːðə/", "My father works here.", "Bố tôi làm việc ở đây."],
  ["child", "đứa trẻ", "/tʃaɪld/", "The child is small.", "Đứa trẻ còn nhỏ."],
  ["people", "mọi người", "/ˈpiːpl/", "Many people are here.", "Nhiều người đang ở đây."],
  ["name", "tên", "/neɪm/", "My name is Nam.", "Tên tôi là Nam."],
];

const PLACES_THINGS: Row[] = [
  ["house", "ngôi nhà", "/haʊs/", "This is my house.", "Đây là nhà tôi."],
  ["home", "nhà (chỗ ở)", "/həʊm/", "I am at home.", "Tôi đang ở nhà."],
  ["school", "trường học", "/skuːl/", "I go to school.", "Tôi đi học."],
  ["office", "văn phòng", "/ˈɒfɪs/", "She is in the office.", "Cô ấy đang ở văn phòng."],
  ["city", "thành phố", "/ˈsɪti/", "Hanoi is a big city.", "Hà Nội là một thành phố lớn."],
  ["country", "đất nước", "/ˈkʌntri/", "Vietnam is my country.", "Việt Nam là đất nước tôi."],
  ["room", "căn phòng", "/ruːm/", "The room is small.", "Căn phòng nhỏ."],
  ["door", "cái cửa", "/dɔː/", "Close the door.", "Đóng cửa lại."],
  ["table", "cái bàn", "/ˈteɪbl/", "The book is on the table.", "Quyển sách ở trên bàn."],
  ["chair", "cái ghế", "/tʃeə/", "Sit on the chair.", "Ngồi lên ghế đi."],
  ["book", "quyển sách", "/bʊk/", "I read a book.", "Tôi đọc một quyển sách."],
  ["phone", "điện thoại", "/fəʊn/", "My phone is new.", "Điện thoại tôi mới."],
  ["money", "tiền", "/ˈmʌni/", "I need money.", "Tôi cần tiền."],
  ["water", "nước", "/ˈwɔːtə/", "I drink water.", "Tôi uống nước."],
  ["food", "đồ ăn", "/fuːd/", "The food is good.", "Đồ ăn ngon."],
  ["rice", "cơm, gạo", "/raɪs/", "I eat rice every day.", "Tôi ăn cơm mỗi ngày."],
  ["coffee", "cà phê", "/ˈkɒfi/", "I like coffee.", "Tôi thích cà phê."],
  ["car", "xe hơi", "/kɑː/", "He has a car.", "Anh ấy có một chiếc xe hơi."],
];

const TIME: Row[] = [
  ["time", "thời gian", "/taɪm/", "I have no time.", "Tôi không có thời gian."],
  ["day", "ngày", "/deɪ/", "Have a good day.", "Chúc một ngày tốt lành."],
  ["today", "hôm nay", "/təˈdeɪ/", "I work today.", "Hôm nay tôi làm việc."],
  ["tomorrow", "ngày mai", "/təˈmɒrəʊ/", "See you tomorrow.", "Hẹn gặp lại ngày mai."],
  ["yesterday", "hôm qua", "/ˈjestədeɪ/", "I was busy yesterday.", "Hôm qua tôi bận."],
  ["morning", "buổi sáng", "/ˈmɔːnɪŋ/", "Good morning.", "Chào buổi sáng."],
  ["night", "buổi tối, đêm", "/naɪt/", "Good night.", "Chúc ngủ ngon."],
  ["week", "tuần", "/wiːk/", "I study every week.", "Tôi học mỗi tuần."],
  ["year", "năm", "/jɪə/", "This year is good.", "Năm nay tốt."],
  ["now", "bây giờ", "/naʊ/", "I am busy now.", "Bây giờ tôi bận."],
];

const ADJECTIVES: Row[] = [
  ["good", "tốt", "/ɡʊd/", "This is good.", "Cái này tốt."],
  ["bad", "tệ, xấu", "/bæd/", "The weather is bad.", "Thời tiết xấu."],
  ["big", "to, lớn", "/bɪɡ/", "It is a big house.", "Đó là một ngôi nhà to."],
  ["small", "nhỏ", "/smɔːl/", "My room is small.", "Phòng tôi nhỏ."],
  ["new", "mới", "/njuː/", "I have a new phone.", "Tôi có điện thoại mới."],
  ["old", "cũ, già", "/əʊld/", "This car is old.", "Chiếc xe này cũ."],
  ["happy", "vui", "/ˈhæpi/", "I am happy today.", "Hôm nay tôi vui."],
  ["sad", "buồn", "/sæd/", "She is sad.", "Cô ấy buồn."],
  ["tired", "mệt", "/ˈtaɪəd/", "I am tired.", "Tôi mệt."],
  ["hungry", "đói", "/ˈhʌŋɡri/", "Are you hungry?", "Bạn đói không?"],
  ["hot", "nóng", "/hɒt/", "It is hot today.", "Hôm nay trời nóng."],
  ["cold", "lạnh", "/kəʊld/", "The water is cold.", "Nước lạnh."],
  ["easy", "dễ", "/ˈiːzi/", "This is easy.", "Cái này dễ."],
  ["hard", "khó", "/hɑːd/", "English is not hard.", "Tiếng Anh không khó."],
];

const FUNCTION_WORDS: Row[] = [
  ["here", "ở đây", "/hɪə/", "Come here.", "Đến đây."],
  ["there", "ở đó", "/ðeə/", "He is there.", "Anh ấy ở đó."],
  ["yes", "vâng, có", "/jes/", "Yes, I do.", "Vâng, có."],
  ["no", "không", "/nəʊ/", "No, thank you.", "Không, cảm ơn."],
  ["not", "không (phủ định)", "/nɒt/", "I am not tired.", "Tôi không mệt."],
  ["very", "rất", "/ˈveri/", "It is very good.", "Cái này rất tốt."],
  ["and", "và", "/ænd/", "You and me.", "Bạn và tôi."],
  ["but", "nhưng", "/bʌt/", "I am tired but happy.", "Tôi mệt nhưng vui."],
  ["because", "bởi vì", "/bɪˈkɒz/", "I am happy because you are here.", "Tôi vui vì bạn ở đây."],
  ["in", "trong, ở", "/ɪn/", "I live in Hanoi.", "Tôi sống ở Hà Nội."],
  ["on", "trên", "/ɒn/", "The book is on the table.", "Quyển sách ở trên bàn."],
  ["at", "tại", "/æt/", "I am at home.", "Tôi đang ở nhà."],
  ["with", "với, cùng", "/wɪð/", "Come with me.", "Đi với tôi."],
  ["please", "làm ơn", "/pliːz/", "Help me, please.", "Làm ơn giúp tôi."],
  ["thank you", "cảm ơn", "/θæŋk juː/", "Thank you very much.", "Cảm ơn rất nhiều."],
  ["sorry", "xin lỗi", "/ˈsɒri/", "Sorry, I am late.", "Xin lỗi, tôi đến muộn."],
  ["what", "cái gì", "/wɒt/", "What is this?", "Đây là cái gì?"],
  ["where", "ở đâu", "/weə/", "Where are you?", "Bạn ở đâu?"],
];

function build(rows: Row[], group: string): StarterWord[] {
  return rows.map(([en, vi, ipa, example, exampleVi]) => ({
    en,
    vi,
    ipa,
    example,
    exampleVi,
    group,
  }));
}

export const STARTER_GROUPS: { id: string; label: string; words: StarterWord[] }[] = [
  { id: "pronouns", label: "Đại từ — ai đang nói", words: build(PRONOUNS, "Đại từ") },
  { id: "verbs", label: "Động từ cốt lõi", words: build(CORE_VERBS, "Động từ") },
  { id: "people", label: "Người và gia đình", words: build(PEOPLE, "Người") },
  { id: "things", label: "Nơi chốn và đồ vật", words: build(PLACES_THINGS, "Đồ vật") },
  { id: "time", label: "Thời gian", words: build(TIME, "Thời gian") },
  { id: "adjectives", label: "Tính từ mô tả", words: build(ADJECTIVES, "Tính từ") },
  { id: "function", label: "Từ nối và câu xã giao", words: build(FUNCTION_WORDS, "Từ chức năng") },
];

export const STARTER_WORDS: StarterWord[] = STARTER_GROUPS.flatMap((g) => g.words);

export const STARTER_WORD_COUNT = STARTER_WORDS.length;

/** 10 mẫu câu sinh tồn — ghép được là nói được việc cơ bản. */
export const SURVIVAL_PATTERNS: { en: string; vi: string; note: string }[] = [
  { en: "I am ___.", vi: "Tôi là / tôi thấy ___", note: "I am Nam. / I am tired." },
  { en: "I have ___.", vi: "Tôi có ___", note: "I have a phone." },
  { en: "I want ___.", vi: "Tôi muốn ___", note: "I want water." },
  { en: "I need ___.", vi: "Tôi cần ___", note: "I need help." },
  { en: "I like ___.", vi: "Tôi thích ___", note: "I like coffee." },
  { en: "I don't ___.", vi: "Tôi không ___", note: "I don't understand." },
  { en: "Do you ___?", vi: "Bạn có ___ không?", note: "Do you speak English?" },
  { en: "Where is ___?", vi: "___ ở đâu?", note: "Where is the toilet?" },
  { en: "How much is ___?", vi: "___ giá bao nhiêu?", note: "How much is this?" },
  { en: "Can you help me?", vi: "Bạn giúp tôi được không?", note: "Câu cứu hộ vạn năng." },
];
