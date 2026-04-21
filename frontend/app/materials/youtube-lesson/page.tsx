"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock3, Globe, ListChecks, Mic, MicOff, PlayCircle, Search, Sparkles, ChevronDown, History, Trash2, ExternalLink, X, FileText } from "lucide-react";

import {
  deleteYouTubeLessonHistory,
  generateInteractiveYouTubeLesson,
  getYouTubeLessonHistoryDetail,
  listYouTubeLessonHistory,
  searchYouTubeVideos,
  translateYouTubeTranscript,
  type InteractiveCheckpoint,
  type YouTubeLessonHistorySummary,
  type YouTubeInteractiveLessonResponse,
  type YouTubeTranscriptSegment,
  type YouTubeVideoItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNotify } from "@/components/use-notify";
import type { SttModel } from "@/types";

const STT_MODEL_OPTIONS: Array<{ value: SttModel; label: string }> = [
  { value: "local-base", label: "Local Whisper Base" },
  { value: "local-small", label: "Local Whisper Small" },
  { value: "whisper-large-v3", label: "Groq Whisper Large v3" },
  { value: "whisper-large-v3-turbo", label: "Groq Whisper Large v3 Turbo" },
];

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        config: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: () => void;
            onStateChange?: () => void;
          };
        }
      ) => {
        destroy: () => void;
        pauseVideo: () => void;
        playVideo: () => void;
        seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
        getCurrentTime: () => number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeScriptPromise: Promise<void> | null = null;

function ensureYoutubeIframeApi(): Promise<void> {
  if (youtubeScriptPromise) return youtubeScriptPromise;

  youtubeScriptPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    const existing = document.getElementById("youtube-iframe-api");
    if (!existing) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }

    window.onYouTubeIframeAPIReady = () => resolve();
  });

  return youtubeScriptPromise;
}

function extractVideoId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function parseTimestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(":").map((part) => Number(part));
  if (parts.some((value) => Number.isNaN(value))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const VOICE_LANGUAGES = [
  { value: "vi-VN", label: "Tiếng Việt", short: "VI" },
  { value: "en-US", label: "Tiếng Anh (Mỹ)", short: "EN" },
  { value: "en-GB", label: "Tiếng Anh (Anh)", short: "UK" },
  { value: "ja-JP", label: "Tiếng Nhật (日本語)", short: "JA" },
  { value: "ko-KR", label: "Tiếng Hàn (한국어)", short: "KO" },
  { value: "zh-CN", label: "Tiếng Trung (Giản thể)", short: "ZH" },
  { value: "zh-TW", label: "Tiếng Trung (Phồn thể)", short: "TW" },
  { value: "fr-FR", label: "Tiếng Pháp (Français)", short: "FR" },
  { value: "de-DE", label: "Tiếng Đức (Deutsch)", short: "DE" },
  { value: "es-ES", label: "Tiếng T.Ban Nha (Español)", short: "ES" },
  { value: "it-IT", label: "Tiếng Ý (Italiano)", short: "IT" },
  { value: "ru-RU", label: "Tiếng Nga (Русский)", short: "RU" },
  { value: "ar-SA", label: "Tiếng Ả Rập (العربية)", short: "AR" },
  { value: "pt-PT", label: "Tiếng Bồ Đào Nha (PT)", short: "PT" },
  { value: "pt-BR", label: "Tiếng Bồ Đào Nha (BR)", short: "BR" },
  { value: "th-TH", label: "Tiếng Thái (ภาษาไทย)", short: "TH" },
  { value: "id-ID", label: "Tiếng Indonesia", short: "ID" },
  { value: "hi-IN", label: "Tiếng Hindi (हिन्दी)", short: "HI" },
  { value: "tr-TR", label: "Tiếng Thổ Nhĩ Kỳ", short: "TR" },
  { value: "nl-NL", label: "Tiếng Hà Lan", short: "NL" },
  { value: "pl-PL", label: "Tiếng Ba Lan", short: "PL" },
  { value: "sv-SE", label: "Tiếng Thụy Điển", short: "SV" },
  { value: "da-DK", label: "Tiếng Đan Mạch", short: "DA" },
  { value: "no-NO", label: "Tiếng Na Uy", short: "NO" },
  { value: "fi-FI", label: "Tiếng Phần Lan", short: "FI" },
  { value: "el-GR", label: "Tiếng Hy Lạp", short: "EL" },
  { value: "cs-CZ", label: "Tiếng Séc", short: "CS" },
  { value: "hu-HU", label: "Tiếng Hungary", short: "HU" },
  { value: "ro-RO", label: "Tiếng Rumani", short: "RO" },
  { value: "uk-UA", label: "Tiếng Ukraina", short: "UA" },
  { value: "ms-MY", label: "Tiếng Mã Lai", short: "MS" },
];

export default function YoutubeInteractiveLessonPage() {
  const [activeTab, setActiveTab] = useState<"summary" | "chapters" | "notes">("summary");
  const [playerReady, setPlayerReady] = useState(false);
  const [input, setInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLimit, setSearchLimit] = useState(6);
  const [sttModel, setSttModel] = useState<SttModel>("local-base");
  const [useSerpApi, setUseSerpApi] = useState(true);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeVideoItem[]>([]);
  const [payload, setPayload] = useState<YouTubeInteractiveLessonResponse | null>(null);
  const [historyItems, setHistoryItems] = useState<YouTubeLessonHistorySummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<string>("vi-VN");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [expandAllLangs, setExpandAllLangs] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [transcriptLang, setTranscriptLang] = useState<string>("original");
  const [translatingTranscript, setTranslatingTranscript] = useState(false);
  const [translatedTranscriptByLang, setTranslatedTranscriptByLang] = useState<Record<string, YouTubeTranscriptSegment[]>>({});
  const [manualTranscript, setManualTranscript] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [error, setError] = useState("");
  const { success, error: notifyError } = useNotify();

  const recognitionRef = useRef<any>(null);

  // Reset expandAllLangs khi đóng menu
  useEffect(() => {
    if (!showLangMenu) {
      const timer = setTimeout(() => setExpandAllLangs(false), 300);
      return () => clearTimeout(timer);
    }
  }, [showLangMenu]);

  const [currentTime, setCurrentTime] = useState(0);
  const [activeCheckpointIndex, setActiveCheckpointIndex] = useState<number | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [revealedAnswer, setRevealedAnswer] = useState(false);
  const [answeredCheckpointIndexes, setAnsweredCheckpointIndexes] = useState<number[]>([]);

  const playerRef = useRef<{
    destroy: () => void;
    pauseVideo: () => void;
    playVideo: () => void;
    seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
    getCurrentTime: () => number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    listYouTubeLessonHistory(0, 20)
      .then((result) => {
        if (cancelled) return;
        setHistoryItems(result.items || []);
      })
      .catch(() => {
        if (cancelled) return;
        setHistoryItems([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let timer: number | null = null;
    if (playerReady && playerRef.current) {
      timer = window.setInterval(() => {
        const next = playerRef.current?.getCurrentTime?.() ?? 0;
        setCurrentTime(next);
      }, 600);
    }

    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [payload?.video.video_id, playerReady]);

  useEffect(() => {
    const videoId = payload?.video.video_id;
    if (!videoId) return;

    let cancelled = false;
    setPlayerReady(false);

    ensureYoutubeIframeApi()
      .then(() => {
        if (cancelled) return;
        if (!window.YT?.Player) return;

        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }

        playerRef.current = new window.YT.Player("interactive-youtube-player", {
          videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            controls: 1,
            playsinline: 1,
            enablejsapi: 1,
          },
          events: {
            onReady: () => {
              setPlayerReady(true);
            },
          },
        });
      })
      .catch(() => {
        setError("Không thể tải YouTube player. Vui lòng thử lại sau.");
      });

    return () => {
      cancelled = true;
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [payload?.video.video_id]);

  const checkpoints = useMemo(() => payload?.lesson.checkpoints ?? [], [payload?.lesson.checkpoints]);

  useEffect(() => {
    if (!playerReady || !checkpoints.length || !playerRef.current) return;
    if (activeCheckpointIndex !== null) return;

    const nextIndex = checkpoints.findIndex((checkpoint, index) => {
      if (answeredCheckpointIndexes.includes(index)) return false;
      return currentTime >= checkpoint.start_seconds;
    });

    if (nextIndex >= 0) {
      playerRef.current.pauseVideo();
      setActiveCheckpointIndex(nextIndex);
      setSelectedAnswer(null);
      setRevealedAnswer(false);
    }
  }, [activeCheckpointIndex, answeredCheckpointIndexes, checkpoints, currentTime, playerReady]);

  const chapterItems = useMemo(() => {
    const chapters = payload?.lesson.chapters ?? [];
    if (chapters.length > 0) return chapters;
    return checkpoints.slice(0, 8).map((cp) => ({ timestamp: cp.timestamp, title: cp.title }));
  }, [payload?.lesson.chapters, checkpoints]);

  const keyNoteItems = useMemo(() => {
    const notes = payload?.lesson.key_notes ?? [];
    if (notes.length > 0) return notes;
    return checkpoints.slice(0, 10).map((cp) => ({ time: cp.timestamp, note: cp.key_point }));
  }, [payload?.lesson.key_notes, checkpoints]);

  const activeTranscriptIndex = useMemo(() => {
    const transcript = payload?.transcript ?? [];
    if (!transcript.length) return -1;

    for (let i = 0; i < transcript.length; i += 1) {
      const current = transcript[i];
      const next = transcript[i + 1];
      const end = next ? next.start : current.start + Math.max(1, current.duration || 0);
      if (currentTime >= current.start && currentTime < end) {
        return i;
      }
    }
    return -1;
  }, [currentTime, payload?.transcript]);

  const originalTranscript = useMemo(() => payload?.transcript ?? [], [payload?.transcript]);
  const translatedTranscript = useMemo(() => {
    if (transcriptLang === "original") return null;
    return translatedTranscriptByLang[transcriptLang] ?? null;
  }, [transcriptLang, translatedTranscriptByLang]);

  function handleVoiceSearch() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = voiceLang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setError("");
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join("");
      setInput(transcript);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") {
        let msg = event.error;
        if (event.error === "not-allowed") msg = "Vui lòng cho phép truy cập Micro trong cài đặt trình duyệt.";
        setError(`Lỗi nhận diện: ${msg}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch (err) {
      setIsListening(false);
    }
  }

  async function handleSearch() {
    const query = input.trim();
    if (!query) return;

    setSearchLoading(true);
    setError("");
    try {
      const items = await searchYouTubeVideos(query, searchLimit);
      setSearchResults(items);
      if (!items.length) {
        setError("Không tìm thấy kết quả YouTube phù hợp.");
      }
    } catch (err) {
      setError(`Lỗi tìm kiếm: ${String(err)}`);
      notifyError(`Lỗi tìm kiếm: ${String(err)}`);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleAnalyze(source?: { video_id?: string; query?: string }) {
    const raw = input.trim();
    if (!raw && !source?.video_id && !source?.query) return;

    // Kiểm tra bắt buộc nếu đang ở chế độ thủ công
    if (showManualEntry && !manualTranscript) {
      setError("Vui lòng nhập transcript trước khi tạo bài học bằng chế độ thủ công.");
      return;
    }

    setAnalyzeLoading(true);
    setError("");
    setActiveCheckpointIndex(null);
    setSelectedAnswer(null);
    setRevealedAnswer(false);
    setAnsweredCheckpointIndexes([]);

    const directVideoId = source?.video_id || extractVideoId(raw);
    const requestPayload = directVideoId
      ? { video_id: directVideoId, max_checkpoints: 5, stt_model: sttModel, use_serpapi: useSerpApi, manual_transcript: showManualEntry ? manualTranscript : undefined }
      : { query: source?.query || raw, max_checkpoints: 5, stt_model: sttModel, use_serpapi: useSerpApi, manual_transcript: showManualEntry ? manualTranscript : undefined };

    try {
      const result = await generateInteractiveYouTubeLesson(requestPayload);
      setPayload(result);
      setTranscriptLang("original");
      setTranslatedTranscriptByLang(result.translations || {});
      const history = await listYouTubeLessonHistory(0, 20);
      setHistoryItems(history.items || []);
      // Reset manual entry state on success
      setShowManualEntry(false);
      setManualTranscript("");
      success("Phân tích video và tạo bài học thành công!");
    } catch (err: any) {
      setPayload(null);
      const errorMsg = String(err);
      setError(`Lỗi phân tích: ${errorMsg}`);
      notifyError(`Lỗi phân tích: ${errorMsg}`);
      
      // Tự động mở ô nhập thủ công nếu lỗi liên quan đến transcript
      if (errorMsg.includes("transcript") || errorMsg.includes("422")) {
        setShowManualEntry(true);
      }
    } finally {
      setAnalyzeLoading(false);
    }
  }

  async function handleOpenHistory(id: string) {
    setAnalyzeLoading(true);
    setError("");
    setActiveCheckpointIndex(null);
    setSelectedAnswer(null);
    setRevealedAnswer(false);
    setAnsweredCheckpointIndexes([]);
    try {
      const item = await getYouTubeLessonHistoryDetail(id);
      setPayload({
        video: item.video,
        transcript: item.transcript,
        lesson: item.lesson,
        translations: item.translations,
      });
      setTranscriptLang("original");
      setTranslatedTranscriptByLang(item.translations || {});
    } catch (err) {
      setError(`Lỗi mở lịch sử: ${String(err)}`);
    } finally {
      setAnalyzeLoading(false);
    }
  }

  async function handleDeleteHistory(id: string) {
    try {
      const itemToDelete = historyItems.find((item) => item.id === id);
      await deleteYouTubeLessonHistory(id);
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));

      if (payload && itemToDelete && payload.video.video_id === itemToDelete.video.video_id) {
        setPayload(null);
      }
      success("Đã xóa lịch sử bài học thành công");
    } catch (err) {
      setError(`Lỗi xóa lịch sử: ${String(err)}`);
      notifyError(`Lỗi xóa lịch sử: ${String(err)}`);
    }
  }

  function jumpToSegment(segment: YouTubeTranscriptSegment) {
    if (!playerRef.current) return;
    playerRef.current.seekTo(segment.start, true);
    playerRef.current.playVideo();
  }

  async function handleTranslateTranscript() {
    if (!payload?.transcript?.length) return;
    if (transcriptLang === "original") return;
    // Removed existing check to allow re-translation

    setTranslatingTranscript(true);
    setError("");
    try {
      const result = await translateYouTubeTranscript(
        payload.transcript, 
        transcriptLang,
        payload.video.video_id
      );
      setTranslatedTranscriptByLang((prev) => ({
        ...prev,
        [transcriptLang]: result.transcript,
      }));
      success(`Đã dịch xong sang ${transcriptLang.toUpperCase()}`);
    } catch (err) {
      setError(`Lỗi dịch transcript: ${String(err)}`);
      notifyError(`Lỗi dịch transcript: ${String(err)}`);
    } finally {
      setTranslatingTranscript(false);
    }
  }

  function jumpToCheckpoint(checkpoint: InteractiveCheckpoint, index: number) {
    if (!playerRef.current) return;
    playerRef.current.seekTo(checkpoint.start_seconds, true);
    playerRef.current.pauseVideo();
    setActiveCheckpointIndex(index);
    setSelectedAnswer(null);
    setRevealedAnswer(false);
  }

  function jumpToTimestamp(timestamp: string) {
    if (!playerRef.current) return;
    const seconds = parseTimestampToSeconds(timestamp);
    playerRef.current.seekTo(seconds, true);
    playerRef.current.playVideo();
  }

  function handleSubmitCheckpointAnswer() {
    if (activeCheckpointIndex === null || selectedAnswer === null) return;
    setRevealedAnswer(true);
  }

  function continueAfterCheckpoint() {
    if (activeCheckpointIndex === null) return;
    setAnsweredCheckpointIndexes((prev) =>
      prev.includes(activeCheckpointIndex) ? prev : [...prev, activeCheckpointIndex]
    );
    setActiveCheckpointIndex(null);
    setSelectedAnswer(null);
    setRevealedAnswer(false);
    playerRef.current?.playVideo();
  }

  const activeCheckpoint = activeCheckpointIndex !== null ? checkpoints[activeCheckpointIndex] : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-6"
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
          Bài Học YouTube Tương Tác
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Nhập link YouTube hoặc từ khóa, hệ thống tự tạo transcript + timestamp + bài học tương tác với auto-pause và câu hỏi.
        </p>
      </div>

      <Card className="p-4 space-y-5">
        <div className="flex flex-col gap-4">
          {/* Hàng 1: Ô nhập liệu và Nút hành động chính */}
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative flex flex-1 items-center">
              <input
                className="h-12 w-full rounded-2xl border border-[var(--border-light)] bg-[var(--bg-primary)] pl-5 pr-12 text-sm text-[var(--text-primary)] outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-50 shadow-sm transition-all"
                placeholder={showManualEntry ? "Dán link YouTube của video này..." : "Dán link YouTube hoặc nhập từ khóa tìm kiếm..."}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    const maybeVideoId = extractVideoId(input);
                    if (maybeVideoId) {
                      handleAnalyze();
                    } else if (!showManualEntry) {
                      handleSearch();
                    }
                  }
                }}
              />
              <div className="absolute right-3 flex items-center">
                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  className={`group relative flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                    isListening
                      ? "bg-rose-500 text-white shadow-lg shadow-rose-200"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-section)] hover:text-brand-500"
                  }`}
                  title="Tìm kiếm bằng giọng nói"
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-5 w-5" />
                      <span className="absolute inset-0 animate-ping rounded-xl bg-rose-400 opacity-20" />
                    </>
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button 
                variant="secondary" 
                onClick={handleSearch} 
                loading={searchLoading} 
                icon={<Search className="h-4 w-4" />}
                className="h-12 rounded-2xl px-6 font-bold"
              >
                Tìm kiếm
              </Button>
              <Button 
                onClick={() => handleAnalyze()} 
                loading={analyzeLoading} 
                icon={<Sparkles className="h-4 w-4" />}
                className={`h-12 rounded-2xl px-6 font-bold shadow-md transition-all ${
                  showManualEntry && (!input || !manualTranscript)
                    ? "opacity-50 cursor-not-allowed bg-[var(--text-muted)] shadow-none"
                    : "shadow-brand-100"
                }`}
                disabled={showManualEntry && (!input || !manualTranscript)}
              >
                {showManualEntry 
                  ? (!input ? "Cần dán link YouTube" : !manualTranscript ? "Cần nhập Transcript" : "Tạo từ Transcript") 
                  : "Tạo bài học"}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Tab chọn chế độ */}
            <div className="flex p-1 bg-[var(--bg-section)] rounded-xl w-fit border border-[var(--border-light)]">
              <button
                onClick={() => setShowManualEntry(false)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  !showManualEntry 
                    ? "bg-white text-brand-600 shadow-sm" 
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Tự động lấy Transcript
              </button>
              <button
                onClick={() => setShowManualEntry(true)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  showManualEntry 
                    ? "bg-white text-brand-600 shadow-sm" 
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Nhập Transcript thủ công
              </button>
            </div>

            <AnimatePresence>
              {showManualEntry && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-brand-600">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Nội dung Transcript</span>
                    </div>
                  </div>
                  
                  <textarea
                    className={`w-full min-h-[180px] rounded-2xl border bg-[var(--bg-section)] p-4 text-sm text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] custom-scrollbar shadow-inner ${
                      showManualEntry && !manualTranscript && input
                        ? "border-rose-400 ring-2 ring-rose-500/10"
                        : "border-brand-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5"
                    }`}
                    placeholder={`Dán transcript vào đây. Định dạng ví dụ:\n0:00\nHello friends, today we discuss vibe coding...\n0:06\nSo what is vibe coding exactly?`}
                    value={manualTranscript}
                    onChange={(e) => setManualTranscript(e.target.value)}
                  />
                  {showManualEntry && !manualTranscript && input && (
                    <motion.p 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[10px] text-rose-500 font-bold flex items-center gap-1"
                    >
                      <span className="h-1 w-1 rounded-full bg-rose-500" /> Vui lòng nhập nội dung transcript để tiếp tục.
                    </motion.p>
                  )}
                  <p className="text-[10px] text-[var(--text-muted)] italic">
                    * AI sẽ dựa vào mốc thời gian bạn cung cấp để tạo câu hỏi và tóm tắt bài học.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Hàng 2: Các thiết lập bổ trợ - Gọn gàng và Trực quan */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[var(--border-light)]/60">
            {/* Ngôn ngữ giọng nói */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangMenu(!showLangMenu)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all ${
                  showLangMenu 
                    ? "border-brand-500 bg-brand-500/10 text-brand-500 ring-2 ring-brand-500/20" 
                    : "border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-brand-400"
                }`}
              >
                <Globe className={`h-4 w-4 ${showLangMenu ? "text-brand-500" : "text-brand-500/70"}`} />
                <span className="text-xs font-bold whitespace-nowrap">
                  {VOICE_LANGUAGES.find((l) => l.value === voiceLang)?.label}
                </span>
                <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${showLangMenu ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {showLangMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 w-72 overflow-hidden rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 shadow-[var(--shadow-lg)] z-[100] ring-1 ring-white/10"
                    >

                      <div className="mb-2 px-3 pt-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)] flex justify-between items-center opacity-90">
                        <span>Ngôn ngữ giọng nói</span>
                        {expandAllLangs && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setExpandAllLangs(false); }}
                            className="text-brand-500 hover:text-brand-400 font-extrabold transition-colors px-2 py-1 rounded-lg hover:bg-brand-500/10"
                          >
                            Thu gọn
                          </button>
                        )}
                      </div>
                      <div className={`grid grid-cols-2 gap-1 overflow-y-auto pr-1 transition-all duration-300 custom-scrollbar ${expandAllLangs ? "max-h-80" : "max-h-none"}`}>
                        {(expandAllLangs ? VOICE_LANGUAGES : VOICE_LANGUAGES.slice(0, 8)).map((lang) => (
                          <button
                            key={lang.value}
                            type="button"
                            onClick={() => {
                              setVoiceLang(lang.value);
                              setShowLangMenu(false);
                            }}
                            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-bold transition-all ${
                              voiceLang === lang.value
                                ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                                : "text-[var(--text-primary)] hover:bg-brand-500/10"
                            }`}
                          >
                            <span className={`text-[9px] min-w-[18px] text-center px-1 py-0.5 rounded font-black ${voiceLang === lang.value ? "bg-white/20 text-white" : "bg-[var(--text-muted)]/20 text-[var(--text-muted)]"}`}>{lang.short}</span>
                            <span className="truncate">{lang.label}</span>
                          </button>
                        ))}
                      </div>
                      
                      {!expandAllLangs && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setExpandAllLangs(true); }}
                          className="mt-2 w-full rounded-xl py-3 text-center text-[10px] font-black uppercase tracking-widest text-brand-500 hover:bg-brand-500/10 transition-colors border-t border-[var(--border-light)]"
                        >
                          Hiện thêm {VOICE_LANGUAGES.length - 8} ngôn ngữ
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* SerpAPI Toggle */}
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-primary)] px-3 py-2">
              <span className="whitespace-nowrap text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-tight">Dùng SerpAPI:</span>
              <button
                type="button"
                onClick={() => setUseSerpApi(!useSerpApi)}
                className={`relative h-5 w-9 rounded-full transition-all ${
                  useSerpApi ? "bg-brand-500" : "bg-[var(--text-muted)]/30"
                }`}
              >
                <span
                  className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${
                    useSerpApi ? "right-1" : "left-1"
                  }`}
                />
              </button>
              <span className="text-[10px] font-bold text-brand-600 uppercase">Fast path</span>
            </div>

            {/* Model Whisper */}
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-primary)] px-3 py-2">
              <span className="whitespace-nowrap text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-tight">STT Model:</span>
              <select
                value={sttModel}
                onChange={(event) => setSttModel(event.target.value as SttModel)}
                className="bg-transparent text-xs font-bold text-brand-600 outline-none cursor-pointer"
              >
                {STT_MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Số lượng video */}
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-section)] p-1">
              <div className="flex gap-1">
                {[1, 3, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSearchLimit(num)}
                    className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${
                      searchLimit === num
                        ? "bg-brand-500 text-white shadow-sm"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div className="h-5 w-px bg-[var(--border-light)] mx-1" />
              <div className="flex items-center gap-1 px-1">
                <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Tùy chỉnh:</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="h-8 w-8 bg-transparent text-center text-xs font-bold text-[var(--text-primary)] outline-none"
                  value={searchLimit}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSearchLimit(Math.min(12, Math.max(1, val)));
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {error ? <p className="text-sm text-rose-500">{error}</p> : null}

        {searchResults.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {searchResults.map((item) => (
              <button
                key={item.video_id}
                type="button"
                onClick={() => {
                  if (showManualEntry) {
                    setInput(item.video_id);
                    // Có thể scroll lên trên để người dùng thấy ô nhập
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    handleAnalyze({ video_id: item.video_id });
                  }
                }}
                className="flex items-start gap-3 rounded-xl border border-[var(--border-light)] bg-[var(--bg-primary)] p-3 text-left transition hover:border-brand-400"
              >
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-section)]">
                  {(item.thumbnail || item.video_id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnail || `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                      <PlayCircle className="h-4 w-4" />
                    </div>
                  )}
                  {item.duration_seconds ? (
                    <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-bold text-white">
                      {formatDuration(item.duration_seconds)}
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.channel || "Kênh không xác định"}</p>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-4 border-t border-[var(--border-light)] pt-5">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-brand-500" />
            <p className="text-base font-bold text-[var(--text-primary)]">Lịch sử bài học của bạn</p>
            <div className="ml-auto flex items-center gap-2">
              {historyLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />}
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-all ${
                  showHistory
                    ? "bg-brand-500 text-white border-brand-500 shadow-md"
                    : "bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-light)] hover:border-brand-400"
                }`}
              >
                {showHistory ? "Ẩn lịch sử" : "Hiện lịch sử"}
                <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${showHistory ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
          
          {historyItems.length === 0 && !historyLoading ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-2xl border-2 border-dashed border-[var(--border-light)] bg-[var(--bg-section)]/30">
              <History className="h-10 w-10 text-[var(--text-muted)] opacity-20 mb-2" />
              <p className="text-sm text-[var(--text-secondary)] font-medium">Chưa có bài học nào được lưu</p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {historyItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-primary)] p-3 shadow-sm hover:shadow-md hover:border-brand-300 transition-all"
                  >
                    <div className="flex gap-3">
                      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-section)] shadow-inner">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={`https://i.ytimg.com/vi/${item.video.video_id}/hqdefault.jpg`} 
                          alt={item.video.title} 
                          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                        {item.video.duration_seconds ? (
                          <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-bold text-white">
                            {formatDuration(item.video.duration_seconds)}
                          </div>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-between">
                        <p className="line-clamp-2 text-xs font-bold text-[var(--text-primary)] leading-relaxed group-hover:text-brand-600 transition-colors">
                          {item.video.title}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] font-medium">
                          {new Date(item.updated_at).toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center gap-2 border-t border-[var(--border-light)] pt-3 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                      {confirmDeleteId === item.id ? (
                        <>
                          <button
                            onClick={() => {
                              handleDeleteHistory(item.id);
                              setConfirmDeleteId(null);
                            }}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-1.5 text-[10px] font-bold text-white hover:bg-rose-700 shadow-sm"
                          >
                            Xác nhận xóa?
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="flex h-8 px-3 items-center justify-center rounded-lg bg-[var(--bg-section)] text-[10px] font-bold text-[var(--text-secondary)] hover:bg-[var(--border-light)] transition-colors"
                          >
                            Hủy
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleOpenHistory(item.id)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-500 py-1.5 text-[10px] font-bold text-white hover:bg-brand-600 shadow-sm"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Xem lại
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                            title="Xóa lịch sử"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
</Card>

      {payload ? (
        <div className="space-y-6">
          {/* Header Bài học */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-[var(--bg-primary)] p-4 rounded-3xl border border-[var(--border-light)] shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/20">
                <PlayCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[var(--text-primary)] leading-tight line-clamp-1">
                  {payload.video.title}
                </h2>
                <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                  {payload.video.channel || "Kênh YouTube"} • {payload.video.video_id}
                </p>
              </div>
            </div>
            <button
              onClick={() => setPayload(null)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600 transition-all hover:bg-rose-600 hover:text-white hover:border-rose-600 shadow-sm dark:bg-rose-500/10 dark:border-rose-500/20"
            >
              <X className="h-4 w-4" />
              Đóng bài học
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Cột Trái: Video và Tương tác chính (Chiếm 2/3) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Khu vực Video */}
              <div className="relative overflow-hidden rounded-[32px] border-4 border-[var(--bg-primary)] bg-black shadow-2xl aspect-video">
                <div id="interactive-youtube-player" className="h-full w-full" />
                
                {/* Overlay khi chưa sẵn sàng */}
                {!playerReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-section)] z-10">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
                      <p className="text-sm font-bold text-[var(--text-secondary)]">Đang chuẩn bị video...</p>
                    </div>
                  </div>
                )}
              </div>

              <Card className="space-y-4">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-brand-500" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Điểm dừng tương tác</h3>
                </div>
                <div className="space-y-2">
                  {payload.lesson.checkpoints.map((checkpoint, index) => (
                    <button
                      key={`${checkpoint.timestamp}-${index}`}
                      type="button"
                      onClick={() => jumpToCheckpoint(checkpoint, index)}
                      className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-primary)] px-4 py-3 text-left transition hover:border-brand-400"
                    >
                      <p className="text-xs font-semibold text-brand-500">{checkpoint.timestamp}</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{checkpoint.title}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{checkpoint.key_point}</p>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-brand-500" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Transcript có timestamp</h3>
                  <div className="ml-auto flex items-center gap-2">
                    <select
                      value={transcriptLang}
                      onChange={(e) => setTranscriptLang(e.target.value)}
                      className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-primary)] px-2 py-1 text-xs font-semibold text-[var(--text-primary)] outline-none"
                    >
                      <option value="original">Bản gốc</option>
                      {VOICE_LANGUAGES.map((lang) => {
                        const isSaved = !!translatedTranscriptByLang[lang.value];
                        return (
                          <option key={lang.value} value={lang.value}>
                            {lang.label} {isSaved ? "✓" : ""}
                          </option>
                        );
                      })}
                    </select>
                    {transcriptLang !== "original" && translatedTranscriptByLang[transcriptLang] ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/10 shrink-0">
                          <Sparkles className="h-3 w-3" />
                          Đã lưu
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleTranslateTranscript}
                          loading={translatingTranscript}
                          className="h-7 text-[10px] font-bold text-[var(--text-secondary)] hover:text-brand-600 hover:bg-brand-50"
                        >
                          Dịch lại
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleTranslateTranscript}
                        loading={translatingTranscript}
                        disabled={transcriptLang === "original"}
                      >
                        Dịch
                      </Button>
                    )}
                  </div>
                </div>
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {originalTranscript.map((segment, index) => (
                    <button
                      key={`${segment.start}-${index}`}
                      type="button"
                      onClick={() => jumpToSegment(segment)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        index === activeTranscriptIndex
                          ? "border-brand-400 bg-brand-500/10"
                          : "border-[var(--border-light)] bg-[var(--bg-primary)] hover:border-brand-300"
                      }`}
                    >
                      <p className="text-xs font-semibold text-brand-500">{segment.timestamp}</p>
                      <p className="mt-1 text-sm text-[var(--text-primary)]">{segment.text}</p>
                      {translatedTranscript?.[index]?.text ? (
                        <div className="mt-2 rounded-lg border border-[var(--border-light)] bg-[var(--bg-section)] px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                            Bản dịch
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {translatedTranscript[index].text}
                          </p>
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="space-y-4">
                <h3 className="text-2xl font-bold text-[var(--text-primary)]">AI Analysis</h3>
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-primary)] p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("summary")}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      activeTab === "summary"
                        ? "bg-[var(--bg-elevated)] text-brand-600"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-section)]"
                    }`}
                  >
                    Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("chapters")}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      activeTab === "chapters"
                        ? "bg-[var(--bg-elevated)] text-brand-600"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-section)]"
                    }`}
                  >
                    Chapters
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("notes")}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      activeTab === "notes"
                        ? "bg-[var(--bg-elevated)] text-brand-600"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-section)]"
                    }`}
                  >
                    Key Notes
                  </button>
                </div>

                {activeTab === "summary" ? (
                  <div className="space-y-4">
                    <p className="whitespace-pre-line text-sm leading-7 text-[var(--text-secondary)]">{payload.lesson.summary}</p>
                    <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                      {payload.lesson.key_takeaways.map((item, index) => (
                        <li key={`${item}-${index}`} className="rounded-xl bg-[var(--bg-primary)] px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {activeTab === "chapters" ? (
                  <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                    {chapterItems.map((chapter, index) => (
                      <button
                        key={`${chapter.timestamp}-${chapter.title}-${index}`}
                        type="button"
                        onClick={() => jumpToTimestamp(chapter.timestamp)}
                        className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-primary)] px-3 py-2 text-left transition hover:border-brand-400"
                      >
                        <p className="text-xs font-semibold text-brand-500">{chapter.timestamp}</p>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{chapter.title}</p>
                      </button>
                    ))}
                  </div>
                ) : null}

                {activeTab === "notes" ? (
                  <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                    {keyNoteItems.map((note, index) => (
                      <button
                        key={`${note.time}-${index}`}
                        type="button"
                        onClick={() => jumpToTimestamp(note.time)}
                        className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-primary)] px-3 py-2 text-left transition hover:border-brand-400"
                      >
                        <p className="text-xs font-semibold text-brand-500">{note.time}</p>
                        <p className="text-sm text-[var(--text-secondary)]">{note.note}</p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </Card>

              {activeCheckpoint ? (
                <Card className="space-y-4 border-brand-400/30 bg-brand-500/10">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-500">Điểm dừng {activeCheckpoint.timestamp}</p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{activeCheckpoint.question}</p>

                  <div className="space-y-2">
                    {activeCheckpoint.choices.map((choice, index) => {
                      const isSelected = selectedAnswer === index;
                      const isCorrect = revealedAnswer && index === activeCheckpoint.correct_answer_index;
                      const isWrongSelected = revealedAnswer && isSelected && index !== activeCheckpoint.correct_answer_index;

                      return (
                        <button
                          key={`${choice}-${index}`}
                          type="button"
                          onClick={() => setSelectedAnswer(index)}
                          disabled={revealedAnswer}
                          className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                            isCorrect
                              ? "border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : isWrongSelected
                              ? "border-rose-500 bg-rose-500/20 text-rose-600 dark:text-rose-400"
                              : isSelected
                              ? "border-brand-500 bg-[var(--bg-primary)] shadow-md"
                              : "border-[var(--border-light)] bg-[var(--bg-primary)] hover:border-brand-400"
                          }`}
                        >
                          {choice}
                        </button>
                      );
                    })}
                  </div>

                  {!revealedAnswer ? (
                    <Button onClick={handleSubmitCheckpointAnswer} disabled={selectedAnswer === null} className="w-full">
                      Kiểm tra đáp án
                    </Button>
                  ) : (
                    <>
                      <p className="rounded-xl bg-[var(--bg-primary)]/50 px-3 py-2 text-sm text-[var(--text-secondary)] border border-[var(--border-light)]">
                        {activeCheckpoint.explanation}
                      </p>
                      <Button onClick={continueAfterCheckpoint} className="w-full">Tiếp tục video</Button>
                    </>
                  )}
                </Card>
              ) : (
                <Card className="text-sm text-[var(--text-secondary)] border-dashed">
                  Video sẽ tự động dừng tại điểm quan trọng để đặt câu hỏi tương tác.
                </Card>
              )}
            </div>
          </div>
        </div>
      ) : null}







    </motion.div>
  );
}
