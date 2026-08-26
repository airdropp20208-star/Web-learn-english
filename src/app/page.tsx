"use client";

import { forwardRef, useState, useSyncExternalStore, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Home,
  Compass,
  Layers,
  BookOpen,
  Library,
  Gamepad2,
  User,
  LineChart,
  Mic,
  MoreHorizontal,
  Coins,
  Flame,
  Sparkles,
} from "lucide-react";
import { HomeTab } from "@/components/tabs/home-tab";
import { PathTab } from "@/components/tabs/path-tab";
import { DecksTab } from "@/components/tabs/decks-tab";
import { StudyTab } from "@/components/tabs/study-tab";
import { LibraryTab } from "@/components/tabs/library-tab";
import { GamesTab } from "@/components/tabs/games-tab";
import { ProfileTab } from "@/components/tabs/profile-tab";
import { ProgressTab } from "@/components/tabs/progress-tab";
import { ShadowTab } from "@/components/tabs/shadow-tab";
import { LandingPage } from "@/components/landing-page";
import { ErrorBoundary } from "@/components/error-boundary";
import { UserMenu } from "@/components/user-menu";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useGamification } from "@/hooks/use-gamification";
import { useCurrentUserId } from "@/hooks/use-current-user-id";

type TabId =
  | "home"
  | "path"
  | "decks"
  | "study"
  | "library"
  | "games"
  | "progress"
  | "shadow"
  | "profile";

type StudyModeId = "flashcard" | "review" | "quiz" | "read";

interface TabDef {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Mô tả ngắn, chỉ hiện trong ngăn kéo "Thêm" trên điện thoại. */
  hint: string;
  /**
   * Có nằm trên thanh dưới của điện thoại không.
   *
   * Thanh dưới chỉ vừa 5 ô cộng nút "Thêm" ở bề ngang 360px; nhồi cả 9 tab
   * vào thì mỗi ô còn 40px, hẹp hơn vùng chạm tối thiểu 44px. Nên năm tab
   * dùng nhiều nhất ở lại thanh dưới, phần còn lại vào ngăn kéo. Thanh bên
   * của desktop không bị giới hạn này nên vẫn hiện đủ chín.
   */
  primary: boolean;
}

const TABS: TabDef[] = [
  { id: "home", label: "Trang chủ", shortLabel: "Nhà", icon: Home, hint: "Việc cần làm hôm nay", primary: true },
  { id: "path", label: "Lộ trình", shortLabel: "Lộ trình", icon: Compass, hint: "Đi từ A1 lên C2", primary: true },
  { id: "decks", label: "Bộ từ", shortLabel: "Bộ từ", icon: Layers, hint: "Chọn và theo dõi bộ từ vựng", primary: true },
  { id: "study", label: "Học", shortLabel: "Học", icon: BookOpen, hint: "Flashcard, ôn tập, quiz, đọc", primary: true },
  { id: "games", label: "Game", shortLabel: "Game", icon: Gamepad2, hint: "Học bằng trò chơi", primary: true },
  { id: "library", label: "Thư viện", shortLabel: "Đọc", icon: Library, hint: "Bài đọc theo trình độ", primary: false },
  { id: "progress", label: "Tiến độ", shortLabel: "Tiến độ", icon: LineChart, hint: "Độ thành thạo và điều kiện lên hạng", primary: false },
  { id: "shadow", label: "Luyện nói", shortLabel: "Nói", icon: Mic, hint: "Nghe rồi nhại lại, có ghi âm", primary: false },
  { id: "profile", label: "Hồ sơ", shortLabel: "Tôi", icon: User, hint: "Thành tích, huy hiệu, cài đặt", primary: false },
];

/**
 * Nhớ rằng người này đã đi qua màn giới thiệu.
 *
 * Không nhớ thì mỗi lần F5 lại rơi về landing và phải bấm "Bắt đầu" lại —
 * phiền nhất với người học hằng ngày, đúng nhóm người dùng chính.
 */
const KEY_DA_VAO_APP = "wle:da-vao-app";

function subscribeDaVaoApp(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function docDaVaoApp(): boolean {
  try {
    return window.localStorage.getItem(KEY_DA_VAO_APP) === "1";
  } catch {
    return false;
  }
}

/** Trên máy chủ chưa đọc được localStorage, nên trả "chưa biết" chứ không đoán. */
function docDaVaoAppTrenServer(): null {
  return null;
}

function ghiDaVaoApp(daVao: boolean) {
  try {
    if (daVao) window.localStorage.setItem(KEY_DA_VAO_APP, "1");
    else window.localStorage.removeItem(KEY_DA_VAO_APP);
  } catch {
    // Chế độ riêng tư chặn localStorage. Chỉ mất phần ghi nhớ, app vẫn chạy.
  }
}

const PRIMARY_TABS = TABS.filter((t) => t.primary);
const SECONDARY_TABS = TABS.filter((t) => !t.primary);

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PageContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 rounded-2xl bg-brand animate-pulse" />
    </div>
  );
}

function PageContent() {
  const searchParams = useSearchParams();
  // Id thật khi đã đăng nhập, id khách khi chưa. Trước đây đây là hằng số ở
  // cấp module nên hai tài khoản trên cùng trình duyệt dùng chung dữ liệu.
  const userId = useCurrentUserId();
  // `?app=1` cho phép mở thẳng vào app (link chia sẻ, e2e). Trước đây một
  // effect đọc query rồi setState — thừa một vòng vẽ và người dùng thấy nháy
  // màn landing. Giờ suy ra ngay lúc vẽ; `landingOverride` chỉ ghi đè khi
  // người dùng tự bấm vào/ra.
  const openAppFromUrl = searchParams.get("app") === "1";
  const [landingOverride, setLandingOverride] = useState<boolean | null>(null);
  const daVaoApp = useSyncExternalStore(
    subscribeDaVaoApp,
    docDaVaoApp,
    docDaVaoAppTrenServer
  );
  const showLanding = landingOverride ?? (!openAppFromUrl && daVaoApp !== true);

  function setShowLanding(hien: boolean) {
    ghiDaVaoApp(!hien);
    setLandingOverride(hien);
  }
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [studyMode, setStudyMode] = useState<StudyModeId>("flashcard");
  const [initialDeckId, setInitialDeckId] = useState<string | undefined>(
    undefined
  );
  const [moreOpen, setMoreOpen] = useState(false);
  // Đọc từ store: tự vẽ lại ngay khi award() cộng điểm, và `useSyncExternalStore`
  // lo phần hydrate nên không lệch nội dung giữa server và client.
  const gamificationState = useGamification();

  function goToTab(tab: TabId) {
    setActiveTab(tab);
    setMoreOpen(false);
  }

  function handleNavigate(tab: string, deckId?: string) {
    if (tab.startsWith("study:")) {
      setStudyMode(tab.slice(6) as StudyModeId);
      setActiveTab("study");
    } else {
      setActiveTab(tab as TabId);
    }
    if (deckId) setInitialDeckId(deckId);
    setShowLanding(false);
  }

  function handleStudyNavigate(mode: StudyModeId) {
    setStudyMode(mode);
    setActiveTab("study");
    setShowLanding(false);
  }

  // Lần vẽ hydrate chưa chạm được localStorage nên chưa biết người này đã
  // từng vào app chưa. Vẽ màn chờ thay vì đoán "chưa": đoán sai thì người
  // quay lại thấy landing nháy qua rồi biến mất, khó chịu hơn là chờ một nhịp.
  if (daVaoApp === null && landingOverride === null && !openAppFromUrl) {
    return <LoadingScreen />;
  }

  if (showLanding) {
    return <LandingPage onStart={() => setShowLanding(false)} />;
  }

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? "";

  return (
    <div className="min-h-screen bg-background">
      {/* Thanh bên (desktop) */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 border-r bg-sidebar flex-col p-4 z-30">
        <button
          onClick={() => setShowLanding(true)}
          aria-label="Về trang giới thiệu"
          className="flex items-center gap-2.5 mb-6 px-1"
        >
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white font-bold">
            L
          </div>
          <div className="text-left leading-tight">
            <div className="font-semibold text-sm">Learn English</div>
            <div className="text-[11px] text-muted-foreground">
              Học có lộ trình
            </div>
          </div>
        </button>

        <nav className="flex flex-col gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => goToTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  isActive
                    ? "bg-brand text-white shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Thẻ streak dưới cùng thanh bên */}
        <div className="mt-auto rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold">
              {gamificationState.streak} ngày liên tiếp
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Học mỗi ngày một chút để không đứt chuỗi.
          </p>
        </div>
      </aside>

      {/* Vùng nội dung — chừa lề trái đúng bằng thanh bên.
          Bản cũ thiếu lề này nên nội dung bị nằm đè dưới thanh bên. */}
      <div className="md:pl-60 flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setShowLanding(true)}
                aria-label="Về trang giới thiệu"
                className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center text-white font-bold text-sm shrink-0 md:hidden"
              >
                L
              </button>
              <h1 className="font-semibold truncate">{activeLabel}</h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Ở 360px, ba viên chỉ số cộng menu tài khoản là tràn ngang. Level
                  và chuỗi ngày vẫn thấy được ở tab Hồ sơ, nên ẩn bớt ở màn hẹp
                  và luôn giữ lại số xu. */}
              <Pill
                icon={<Sparkles className="w-3.5 h-3.5" />}
                value={`Lv ${gamificationState.level}`}
                className="hidden xs:inline-flex bg-primary/10 text-primary"
              />
              <Pill
                icon={<Coins className="w-3.5 h-3.5" />}
                value={gamificationState.coins}
                className="bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
              />
              <Pill
                icon={<Flame className="w-3.5 h-3.5" />}
                value={gamificationState.streak}
                className="hidden sm:inline-flex bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400"
              />
              <UserMenu />
            </div>
          </div>
        </header>

        <main
          key={activeTab}
          className="flex-1 w-full max-w-4xl mx-auto px-4 py-5 pb-28 md:pb-8 animate-rise"
        >
          {/* Bọc riêng từng tab: một tab hỏng thì chỉ ô nội dung hiện lỗi,
              thanh điều hướng vẫn còn để người dùng đi chỗ khác. Boundary
              nằm trong <main key={activeTab}> nên tự quên lỗi khi đổi tab. */}
          <ErrorBoundary ten={`Tab ${activeLabel}`}>
            {activeTab === "home" && (
              <HomeTab onNavigate={(t) => handleNavigate(t)} />
            )}
            {activeTab === "path" && <PathTab />}
            {activeTab === "decks" && (
              <DecksTab
                userId={userId}
                onNavigate={(t, did) => handleNavigate(t, did)}
              />
            )}
            {activeTab === "study" && (
              <StudyTab
                userId={userId}
                initialMode={studyMode}
                initialDeckId={initialDeckId}
                onNavigate={handleStudyNavigate}
              />
            )}
            {activeTab === "library" && <LibraryTab userId={userId} />}
            {activeTab === "games" && <GamesTab userId={userId} />}
            {activeTab === "progress" && <ProgressTab userId={userId} />}
            {activeTab === "shadow" && <ShadowTab userId={userId} />}
            {activeTab === "profile" && <ProfileTab userId={userId} />}
          </ErrorBoundary>
        </main>
      </div>

      {/* Thanh điều hướng dưới (điện thoại): năm tab chính cộng ngăn kéo "Thêm" */}
      <nav
        aria-label="Điều hướng chính"
        className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/90 backdrop-blur-xl md:hidden pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-6">
          {PRIMARY_TABS.map((tab) => (
            <BottomNavButton
              key={tab.id}
              icon={tab.icon}
              label={tab.shortLabel}
              active={activeTab === tab.id}
              onClick={() => goToTab(tab.id)}
            />
          ))}

          <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
            <DrawerTrigger asChild>
              <BottomNavButton
                icon={MoreHorizontal}
                label="Thêm"
                /* Sáng lên cả khi tab đang mở nằm trong ngăn kéo, để người dùng
                   không tưởng mình đang lạc ngoài mọi mục. */
                active={SECONDARY_TABS.some((t) => t.id === activeTab)}
                aria-label="Mở thêm mục"
              />
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="text-left">
                <DrawerTitle>Thêm</DrawerTitle>
                <DrawerDescription>
                  Những mục không nằm trên thanh dưới.
                </DrawerDescription>
              </DrawerHeader>
              <div className="grid grid-cols-2 gap-2 px-4 pb-6">
                {SECONDARY_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => goToTab(tab.id)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                        isActive
                          ? "border-brand bg-brand/10"
                          : "hover:bg-accent"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${
                          isActive ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                      <span className="text-sm font-medium">{tab.label}</span>
                      <span className="text-[11px] text-muted-foreground leading-snug">
                        {tab.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
              <DrawerClose className="sr-only">Đóng</DrawerClose>
            </DrawerContent>
          </Drawer>
        </div>
      </nav>
    </div>
  );
}

/**
 * Một ô trên thanh dưới. Tách ra vì nút "Thêm" phải nhận được `ref` và các
 * props mà `DrawerTrigger asChild` truyền xuống — trước đây nav dựng nút
 * ngay tại chỗ nên không làm được việc đó.
 */
const BottomNavButton = forwardRef<
  HTMLButtonElement,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    active: boolean;
  } & React.ComponentPropsWithoutRef<"button">
>(function BottomNavButton({ icon: Icon, label, active, ...props }, ref) {
  return (
    <button
      ref={ref}
      aria-current={active ? "page" : undefined}
      /* min-h-14: giữ vùng chạm không tụt dưới ngưỡng 44px kể cả ở 360px. */
      className="relative flex min-h-14 flex-col items-center justify-center gap-1 py-2"
      {...props}
    >
      {/* Vạch chỉ báo tab đang chọn */}
      <span
        className={`absolute top-0 h-0.5 w-8 rounded-full transition-opacity ${
          active ? "bg-brand opacity-100" : "opacity-0"
        }`}
      />
      <Icon
        className={`w-5 h-5 transition-colors ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      />
      <span
        className={`text-[10px] font-medium transition-colors ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </button>
  );
});

function Pill({
  icon,
  value,
  className,
}: {
  icon: React.ReactNode;
  value: string | number;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}
    >
      {icon}
      {value}
    </span>
  );
}
