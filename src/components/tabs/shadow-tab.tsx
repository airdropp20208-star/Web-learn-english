"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Headphones,
  Play,
  Pause,
  Mic,
  MicOff,
  Square,
  RotateCcw,
  Save,
  Smartphone,
} from "lucide-react";
import type { TextDTO, ShadowSessionDTO, CEFRLevel } from "@/lib/types";
import { getTexts, createShadowSession, getShadowSessions } from "@/lib/storage";
import { CEFR_COLOR } from "@/lib/level-colors";
import {
  LOCAL_RECORDING_MARKER,
  deleteRecording,
  listRecordedSessionIds,
  loadRecording,
  saveRecording,
} from "@/lib/recording-store";

interface ShadowTabProps {
  userId: string;
}

/**
 * Năng lực của trình duyệt không đổi trong một lượt tải trang, nên không có
 * gì để đăng ký lắng nghe. Vẫn phải đi qua `useSyncExternalStore` vì đó là
 * cách duy nhất đọc `window` mà không lệch giữa server và client — và cũng
 * là khuôn mà `use-mobile.ts` đã dùng cho cùng loại việc.
 */
function khongDoi(): () => void {
  return () => {};
}

function coTTS(): boolean {
  return "speechSynthesis" in window;
}

function coGhiAm(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    // Trên HTTP (không phải localhost) `mediaDevices` đơn giản là không có.
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * Trên server chưa biết trình duyệt có gì. Giả định là có, để HTML dựng sẵn
 * hiện đủ nút và không nháy một nhịp "không hỗ trợ" rồi mới đổi lại. Máy nào
 * thực sự thiếu thì React sửa ngay sau khi hydrate.
 */
function coTheoMacDinh(): boolean {
  return true;
}

/**
 * Vì sao micro không dùng được — nói đúng lý do thay vì một câu chung chung.
 *
 * Bản cũ mọi lỗi đều ra "Microphone access denied", kể cả khi máy không có
 * micro hoặc trang chạy trên HTTP. Người dùng đi mở lại quyền trong cài đặt
 * trình duyệt và tất nhiên không sửa được gì.
 */
function moTaLoiMicro(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Trình duyệt đã chặn micro. Mở phần quyền của trang (biểu tượng ổ khoá cạnh thanh địa chỉ) rồi cho phép micro.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Không tìm thấy micro nào trên máy này.";
    case "NotReadableError":
      return "Micro đang bị ứng dụng khác chiếm. Đóng ứng dụng đó rồi thử lại.";
    default:
      return "Không mở được micro. Hãy thử lại hoặc dùng trình duyệt khác.";
  }
}

export function ShadowTab({ userId }: ShadowTabProps) {
  const [texts, setTexts] = useState<TextDTO[]>([]);
  const [sessions, setSessions] = useState<ShadowSessionDTO[]>([]);
  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set());
  const [selectedTextId, setSelectedTextId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Bản ghi vừa thu, chưa lưu. Giữ cả `Blob` vì blob URL không đọc ngược được. */
  const [draft, setDraft] = useState<{ blob: Blob; url: string } | null>(null);
  /** Phiên trong lịch sử đang được nghe lại. */
  const [replay, setReplay] = useState<{ id: string; url: string } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  /**
   * Mọi blob URL đã tạo trong lượt sống của component.
   *
   * Thu hồi theo state thôi là chưa đủ: nếu người dùng ghi âm ba lần rồi đóng
   * tab, hai URL đầu đã bị state ghi đè và không còn ai giữ tham chiếu để mà
   * thu hồi. Trình duyệt sẽ giữ nguyên các blob đó tới khi tải lại trang.
   */
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const taoBlobUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    return url;
  }, []);

  const thuHoiBlobUrl = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  }, []);

  // Năng lực của trình duyệt là kho dữ liệu ngoài React, đọc bằng
  // `useSyncExternalStore` theo đúng khuôn `use-mobile.ts`; lý do ở chú thích
  // của `khongDoi` phía trên.
  const ttsSupported = useSyncExternalStore(khongDoi, coTTS, coTheoMacDinh);
  const recorderSupported = useSyncExternalStore(khongDoi, coGhiAm, coTheoMacDinh);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const [t, s] = await Promise.all([getTexts(userId), getShadowSessions(userId)]);
        // Danh sách bản ghi cục bộ hỏng không đáng làm hỏng cả tab: vẫn xem
        // được lịch sử, chỉ là không nút nào bật lên.
        const ids = await listRecordedSessionIds().catch(() => new Set<string>());
        if (cancelled) return;
        setTexts(t);
        setSessions(s);
        setRecordedIds(ids);
        if (t.length > 0) setSelectedTextId(t[0].id);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Dọn dẹp lúc rời tab. Tách khỏi effect nạp dữ liệu vì cái đó chạy lại mỗi
  // khi `userId` đổi, còn việc dọn này chỉ đúng một lần lúc gỡ khỏi DOM.
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  const selectedText = useMemo(
    () => texts.find((t) => t.id === selectedTextId) ?? null,
    [texts, selectedTextId]
  );

  const sentences = useMemo(() => {
    if (!selectedText) return [];
    return selectedText.content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [selectedText]);

  function handlePlay() {
    if (!selectedText || !ttsSupported) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(selectedText.content);
    u.lang = "en-US";
    u.rate = 0.95;
    u.onend = () => {
      setPlaying(false);
      setPaused(false);
    };
    u.onerror = () => {
      setPlaying(false);
      setPaused(false);
      toast.error("Trình duyệt không đọc được đoạn này.");
    };
    window.speechSynthesis.speak(u);
    setPlaying(true);
    setPaused(false);
  }

  function handlePause() {
    if (!ttsSupported) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }

  function handleStop() {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    setPlaying(false);
    setPaused(false);
  }

  async function handleStartRecording() {
    if (!recorderSupported) return;
    // Nghe giọng máy và giọng mình chồng lên nhau thì không nhại được, mà
    // micro còn thu lại cả tiếng loa.
    if (playing) handleStop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setDraft((cu) => {
          if (cu) thuHoiBlobUrl(cu.url);
          return blob.size > 0 ? { blob, url: taoBlobUrl(blob) } : null;
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mr.onerror = () => {
        toast.error("Ghi âm bị gián đoạn.");
        setRecording(false);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      toast.error(moTaLoiMicro(err));
    }
  }

  function handleStopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }

  function handleResetRecording() {
    if (!draft) return;
    thuHoiBlobUrl(draft.url);
    setDraft(null);
  }

  async function handleSaveSession() {
    if (!selectedText || !draft) return;
    setSaving(true);
    try {
      const session = await createShadowSession(userId, {
        textId: selectedText.id,
        // Không phải URL truy cập được, mà là cờ đánh dấu "âm thanh nằm trong
        // IndexedDB của máy này". Bản cũ nhét blob URL vào đây và nó chết ngay
        // lần tải trang sau.
        userRecordingUrl: LOCAL_RECORDING_MARKER,
      });
      await saveRecording(session.id, draft.blob);
      setSessions((cu) => [session, ...cu]);
      setRecordedIds((cu) => new Set(cu).add(session.id));
      handleResetRecording();
      toast.success("Đã lưu buổi luyện nói.");
    } catch {
      toast.error("Không lưu được bản ghi. Bộ nhớ trình duyệt có thể đã đầy.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReplay(sessionId: string) {
    if (replay?.id === sessionId) {
      thuHoiBlobUrl(replay.url);
      setReplay(null);
      return;
    }
    try {
      const blob = await loadRecording(sessionId);
      if (!blob) {
        toast.error("Không tìm thấy bản ghi trên thiết bị này.");
        setRecordedIds((cu) => {
          const next = new Set(cu);
          next.delete(sessionId);
          return next;
        });
        return;
      }
      if (replay) thuHoiBlobUrl(replay.url);
      setReplay({ id: sessionId, url: taoBlobUrl(blob) });
    } catch {
      toast.error("Không đọc được bản ghi.");
    }
  }

  async function handleDeleteRecording(sessionId: string) {
    try {
      await deleteRecording(sessionId);
      if (replay?.id === sessionId) {
        thuHoiBlobUrl(replay.url);
        setReplay(null);
      }
      setRecordedIds((cu) => {
        const next = new Set(cu);
        next.delete(sessionId);
        return next;
      });
      toast.success("Đã xoá bản ghi khỏi máy này.");
    } catch {
      toast.error("Không xoá được bản ghi.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Không tải được dữ liệu luyện nói.
          </p>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Thử lại
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (texts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Chưa có bài nào để luyện. Vào <strong>Học → Đọc</strong> dán một đoạn
          văn, hoặc mở <strong>Thư viện</strong> chọn một bài đọc — bài lưu lại
          sẽ hiện ở đây.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chọn bài để nhại</CardTitle>
            <CardDescription>
              Nghe máy đọc trước, rồi tự thu giọng mình đọc lại đoạn đó.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="shadow-text-select">Bài đọc</Label>
              <Select value={selectedTextId} onValueChange={setSelectedTextId}>
                <SelectTrigger id="shadow-text-select">
                  <SelectValue placeholder="Chọn một bài" />
                </SelectTrigger>
                <SelectContent>
                  {texts.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title} ({t.cefrLevel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedText && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">
                    {selectedText.title}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {sentences.length} câu
                  </CardDescription>
                </div>
                <Badge className={CEFR_COLOR[selectedText.cefrLevel]}>
                  {selectedText.cefrLevel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Giọng máy đọc mẫu */}
              <div className="border rounded-md p-3 space-y-3 bg-accent/30">
                <div className="text-xs text-muted-foreground font-medium">
                  Giọng đọc mẫu
                </div>
                {ttsSupported ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {!playing ? (
                      <Button onClick={handlePlay} size="sm">
                        <Play className="w-4 h-4 mr-1.5" />
                        Nghe
                      </Button>
                    ) : (
                      <Button onClick={handlePause} size="sm" variant="secondary">
                        <Pause className="w-4 h-4 mr-1.5" />
                        {paused ? "Tiếp tục" : "Tạm dừng"}
                      </Button>
                    )}
                    <Button onClick={handleStop} size="sm" variant="outline">
                      <Square className="w-3.5 h-3.5 mr-1.5" />
                      Dừng
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Trình duyệt này không có giọng đọc sẵn. Bạn vẫn ghi âm được,
                    chỉ là không nghe mẫu ở đây.
                  </p>
                )}
              </div>

              {/* Ghi âm giọng mình */}
              <div className="border rounded-md p-3 space-y-3">
                <div className="text-xs text-muted-foreground font-medium">
                  Bản ghi của bạn
                </div>

                {!recorderSupported ? (
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MicOff className="w-4 h-4 shrink-0 mt-px" />
                    <span>
                      Trình duyệt này không cho ghi âm. Thường là do trang đang
                      chạy trên kết nối không bảo mật — micro chỉ hoạt động qua
                      HTTPS.
                    </span>
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      {!recording ? (
                        <Button
                          onClick={handleStartRecording}
                          size="sm"
                          variant="destructive"
                        >
                          <Mic className="w-4 h-4 mr-1.5" />
                          Ghi âm
                        </Button>
                      ) : (
                        <Button onClick={handleStopRecording} size="sm">
                          <Square className="w-3.5 h-3.5 mr-1.5" />
                          Dừng ghi
                        </Button>
                      )}
                      {draft && (
                        <>
                          <Button
                            onClick={handleResetRecording}
                            size="sm"
                            variant="outline"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            Bỏ
                          </Button>
                          <Button onClick={handleSaveSession} size="sm" disabled={saving}>
                            <Save className="w-3.5 h-3.5 mr-1.5" />
                            {saving ? "Đang lưu…" : "Lưu buổi này"}
                          </Button>
                        </>
                      )}
                    </div>
                    {recording && (
                      <div className="text-xs text-rose-600 animate-pulse">
                        ● Đang ghi…
                      </div>
                    )}
                    {draft && <audio controls src={draft.url} className="w-full" />}
                  </>
                )}
              </div>

              {/* Nội dung bài, để mắt bám theo lúc đọc */}
              <div className="border-l-2 pl-3 text-sm leading-relaxed max-h-60 overflow-y-auto">
                {sentences.map((s, i) => (
                  <p key={i} className="mb-1">
                    {s}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lịch sử */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Headphones className="w-4 h-4" />
            Đã luyện
          </CardTitle>
          <CardDescription className="text-xs flex items-start gap-1.5">
            <Smartphone className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>Bản ghi lưu trên máy này, không đi theo tài khoản.</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có buổi nào.</p>
          ) : (
            <ScrollArea className="h-80">
              <div className="space-y-2 pr-2">
                {sessions.map((s) => {
                  const text = texts.find((t) => t.id === s.textId);
                  const coBanGhi = recordedIds.has(s.id);
                  const dangNghe = replay?.id === s.id;
                  return (
                    <div key={s.id} className="border rounded-md p-2 text-sm space-y-1.5">
                      <div className="font-medium truncate">
                        {text?.title ?? "Bài đã xoá"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.completedAt).toLocaleString("vi-VN")}
                      </div>
                      {coBanGhi ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleReplay(s.id)}
                          >
                            {dangNghe ? "Ẩn" : "Nghe lại"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            onClick={() => handleDeleteRecording(s.id)}
                          >
                            Xoá bản ghi
                          </Button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Bản ghi không có trên thiết bị này.
                        </p>
                      )}
                      {dangNghe && replay && (
                        <audio controls src={replay.url} className="w-full h-8" />
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
