// Hài hước comments — hiển thị sau khi học/review/game
// Kiểu commentary nhẹ nhàng, không gây khó chịu

const LEARN_COMMENTS = [
  "Từ này dễ quá, não bạn đang chill 🧘",
  "Lưu xong! Giờ quên là tội ác 😏",
  "Một từ nữa vào bộ sưu tập. Bạn đang xây đế chế từ vựng! 🏰",
  "Não bạn vừa nạp thêm 1 cell nhớ. Tiếp tục nào! 🧠",
  "Từ này hay ho đấy, dùng được flex với bạn bè 😎",
  "Lưu! Lần sau gặp lại nhớ nhận ra nhé, đừng fake news 📰",
  "Một bước nhỏ cho người, một bước khổng lồ cho... điểm số của bạn 🚀",
  "Từ vựng +1! Tiếng Anh đang run sợ vì bạn 💪",
  "Lưu xong! Nếu quên từ này, coin sẽ bị trừ (đùa thôi, không trừ đâu) 😄",
  "Bạn đang học nhanh hơn tốc độ bạn của bạn bỏ cuộc 🏃",
];

const REVIEW_CORRECT = [
  "Chính xác! Não bạn đang fire 🔥",
  "Đúng! Bạn và từ này có duyên 💫",
  "Chuẩn luôn! Có vẻ hôm nay bạn tỉnh táo 🎯",
  "Đúng! Trí nhớ bạn hoạt động tốt hơn cả deadline 😤",
  "Chính xác! Từ này đã bị bạn chinh phục 🏆",
  "Đúng! FSRS sẽ giãn lịch ôn — bạn xứng đáng 😌",
  "Chuẩn! Bạn đang trên đường thành vet tiếng Anh 🎓",
  "Đúng! Coin + XP lên luôn, nhưng quan trọng là bạn nhớ 💎",
];

const REVIEW_WRONG = [
  "Sai rồi! Nhưng đừng buồn, FSRS sẽ nhắc lại sớm ⏰",
  "Sai! Từ này cứng đầu, lần sau gặp lại sẽ nhớ 💪",
  "Chưa đúng. Não bạn cần thêm thời gian với từ này 🧠",
  "Sai rồi! Nhưng mà fail là mẹ thành công (ngta bảo vậy) 😅",
  "Chưa chính xác. Lần sau FSRS sẽ đưa từ này về sớm hơn 📅",
  "Sai! Đừng lo, ngay cả người bản xứ cũng có lúc quên 🤷",
];

const GAME_WIN = [
  "Bạn thắng! Có vẻ não bạn đang ở mode beast 🦁",
  "Win! Coin + XP chảy về tài khoản như lương 💰",
  "Chiến thắng! Bạn đang farm XP như game thủ thật 🎮",
  "Thắng! Từ vựng sợ bạn từ nay 📚",
  "Win! Streak của bạn đẹp hơn cả relationship status 💔",
];

const GAME_LOSE = [
  "Thua rồi! Nhưng mà học được từ mới là win 🤷",
  "Game over! Lần sau train thêm nhé 💪",
  "Thua! Não bạn cần warm-up thêm 🧠",
  "Chưa thắng, nhưng mà có XP an ủi 🎮",
];

const STREAK_MILESTONE = [
  "🔥 Streak {n} ngày! Bạn đang ở mode kiên trì",
  "⚡ {n} ngày liên tiếp! Não bạn đang được train đều đặn",
  "🌟 Streak {n}! Bạn xứng đáng nhận huy chương kiên trì",
  "👑 {n} ngày! Bạn đang beat 99% người bỏ cuộc",
];

const LEVEL_UP = [
  "🎉 LEVEL UP! Bạn vừa lên level {n}",
  "🚀 Level {n}! Tiếng Anh đang sợ bạn",
  "🏆 Level {n}! Bạn đang trên top của chính mình",
  "💎 Level {n}! XP farm hiệu quả đấy",
];

const ACHIEVEMENT_UNLOCK = [
  "🏅 Achievement unlocked: {name}!",
  "⭐ Bạn vừa mở khóa: {name}",
  "🎉 {name}! Bạn pro đấy",
];

const DAILY_GOAL_DONE = [
  "🎯 Hoàn thành mục tiêu hôm nay! Bạn có thể nghỉ ngơi (hoặc học thêm)",
  "✅ Daily goal done! Não bạn xứng đáng được treat",
  "🌟 Mục tiêu ngày hoàn thành! Bạn đang xây thói quen tốt",
  "💪 Done! Ngày mai tiếp tục nhé, đừng break streak",
];

const NO_ACTIVITY = [
  "Hmm, hôm nay bạn chưa học gì. Não đang nghỉ phép? 🏖️",
  "Streak đang chờ bạn! Mở app ≠ học, bạn ơi 😏",
  "Coin không tự sinh ra. Học đi! 💰",
  "Mục tiêu hôm nay: 0/{goal}. Bạn đang ngủ đông à? 🐻",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getLearnComment(): string {
  return pick(LEARN_COMMENTS);
}

export function getReviewComment(correct: boolean): string {
  return pick(correct ? REVIEW_CORRECT : REVIEW_WRONG);
}

export function getGameComment(won: boolean): string {
  return pick(won ? GAME_WIN : GAME_LOSE);
}

export function getStreakComment(streak: number): string {
  return pick(STREAK_MILESTONE).replace("{n}", String(streak));
}

export function getLevelUpComment(level: number): string {
  return pick(LEVEL_UP).replace("{n}", String(level));
}

export function getAchievementComment(name: string): string {
  return pick(ACHIEVEMENT_UNLOCK).replace("{name}", name);
}

export function getDailyGoalDoneComment(): string {
  return pick(DAILY_GOAL_DONE);
}

export function getNoActivityComment(goal: number): string {
  return pick(NO_ACTIVITY).replace("{goal}", String(goal));
}
