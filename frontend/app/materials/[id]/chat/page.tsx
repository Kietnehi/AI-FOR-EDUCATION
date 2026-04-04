"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { FormEvent, memo, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  MessageSquareText,
  History,
  Plus,
  Send,
  Bot,
  User,
  Mic,
  Square,
  FileText,
  Loader2,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  X,
  AlertCircle,
  Play,
  Pause,
  Globe,
  Trash2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { ChatSkeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/ui/markdown";
import { ReasoningBlock } from "@/components/ui/reasoning-block";
import { TtsMarkdown } from "@/components/ui/tts-markdown";
import { WebSearchResult } from "@/components/ui/web-search-result";
import {
  createChatSession,
  deleteChatSession,
  deleteChatSessionsByMaterial,
  getChatSession,
  listChatSessions,
  sendChatMessage,
  streamChatMessage,
  synthesizeChatSpeech,
  transcribeChatAudio,
  webSearch,
} from "@/lib/api";
import { formatVietnamDateTime } from "@/lib/datetime";
import { getAudioDurationFromUrl, getSegmentBaseTime, splitTextForTts } from "@/lib/tts";
import type { ChatMessage, ChatSession, SttModel } from "@/types";

const EMPTY_CHAT_SUGGESTIONS = [
  "Tóm tắt nội dung chính",
  "Giải thích khái niệm quan trọng",
  "Cho ví dụ minh họa",
];

const getChatSessionStorageKey = (materialId: string) => `chatbot-session-id:${materialId}`;

type ChatMessageItemProps = {
  message: ChatMessage;
  isSpeaking: boolean;
  onToggleSpeak: (messageId: string, content: string) => void;
  onOpenImage: (image: string) => void;
  isStreaming?: boolean;
  reasoningEnabled?: boolean;
};

type PreparedTtsSegment = {
  text: string;
  audioUrl: string;
  duration: number;
};

const ChatMessageItem = memo(function ChatMessageItem({
  message,
  isSpeaking,
  onToggleSpeak,
  onOpenImage,
  isStreaming,
  reasoningEnabled,
}: ChatMessageItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
    >
      <div className={`
        w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1
        ${message.role === "assistant"
          ? "bg-gradient-to-br from-brand-500 to-accent-500"
          : "bg-gradient-to-br from-emerald-500 to-emerald-600"
        }
      `}>
        {message.role === "assistant" ? (
          <Bot className="w-4 h-4 text-white" />
        ) : (
          <User className="w-4 h-4 text-white" />
        )}
      </div>

      <div className={`
        max-w-[85%] rounded-2xl px-4 py-3
        ${message.role === "user"
          ? "bg-gradient-to-r from-brand-600 to-accent-500 text-white rounded-tr-sm"
          : "bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] rounded-tl-sm"
        }
      `}>
        {message.role === "assistant" && message.reasoning_details && reasoningEnabled && (
          <ReasoningBlock
            isStreaming={isStreaming}
            reasoning={message.reasoning_details.reasoning || message.reasoning_details.reasoning_content || JSON.stringify(message.reasoning_details)}
          />
        )}
        {message.role === "assistant" && (
           <div className="mt-1 flex items-center justify-between gap-2 overflow-hidden mb-2">
             <div className="flex flex-wrap items-center gap-1.5 leading-none">
               {message.model_used && (
                 <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-brand-50/80 dark:bg-brand-900/40 text-brand-500 dark:text-brand-400 border border-brand-100 dark:border-brand-800/60 uppercase tracking-tight">
                   <Bot className="w-2.5 h-2.5" />
                   Model: {message.model_used}
                 </span>
               )}
               {message.fallback_applied && (
                 <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200/50 uppercase tracking-tight">
                   <AlertCircle className="w-2.5 h-2.5" />
                   Dự phòng
                 </span>
               )}
             </div>
           </div>
        )}
        {message.role === "user" ? (
          <p className="text-sm leading-relaxed m-0 whitespace-pre-wrap">
            {message.message}
          </p>
        ) : message.is_web_search && message.search_results ? (
          <WebSearchResult
            answer={message.message}
            sources={message.search_results.sources}
            citations={message.search_results.sources.map((s) => ({
              index: s.index,
              title: s.title,
              url: s.uri,
              source: message.search_results!.search_provider,
            }))}
            searchProvider={message.search_results.search_provider}
            searchQueries={message.search_results.search_queries}
          />
        ) : (
          <Markdown content={message.message} />
        )}

        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.images.map((img, index) => (
              <img
                key={index}
                src={img}
                alt={`upload ${index}`}
                className="max-w-[200px] max-h-[200px] object-cover rounded-lg border border-[var(--border-light)] cursor-pointer hover:opacity-90"
                loading="lazy"
                decoding="async"
                onClick={() => onOpenImage(img)}
              />
            ))}
          </div>
        )}

        {message.role === "assistant" && (
          <div className="mt-2 flex items-center justify-end gap-2">
            {message.fallback_applied && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                <AlertCircle className="w-3 h-3" />
                {`Đã chuyển sang model dự phòng: ${message.model_used || "không xác định"}`}
              </span>
            )}
            <button
              type="button"
              onClick={() => onToggleSpeak(message.id, message.message)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-brand-600 hover:bg-brand-50 transition-colors"
              aria-label={isSpeaking ? "Dừng đọc nội dung" : "Đọc nội dung"}
            >
              {isSpeaking ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
              {isSpeaking ? "Dừng" : "Nghe"}
            </button>
          </div>
        )}

        {!message.is_web_search && message.citations?.length > 0 && (
          <div className="mt-3 pt-2 border-t border-white/20 space-y-1.5">
            <p className="text-xs font-semibold flex items-center gap-1 opacity-80">
              <FileText className="w-3 h-3" />
              Nguồn tham khảo
            </p>
            {message.citations.map((citation, index) => (
              <div
                key={index}
                className={`
                  text-xs rounded-lg px-3 py-2
                  ${message.role === "user"
                    ? "bg-white/15"
                    : "bg-[var(--bg-primary)] border border-[var(--border-default)]"
                  }
                `}
              >
                <span className="font-medium">Chunk {citation.chunk_index + 1}: </span>
                <span className="opacity-80">{citation.snippet.slice(0, 120)}...</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});

ChatMessageItem.displayName = "ChatMessageItem";

export default function ChatbotPage() {
  const params = useParams<{ id: string }>();
  const materialId = params.id;

  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [useGoogleSearch, setUseGoogleSearch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<ChatSession[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyActionId, setHistoryActionId] = useState<string | null>(null);
  const [isDeletingAllHistory, setIsDeletingAllHistory] = useState(false);
  const [sessionPendingDelete, setSessionPendingDelete] = useState<ChatSession | null>(null);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [ttsLang, setTtsLang] = useState("vi");
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsSegments, setTtsSegments] = useState<PreparedTtsSegment[]>([]);
  const [ttsSegmentIndex, setTtsSegmentIndex] = useState(0);
  const [ttsCurrentTime, setTtsCurrentTime] = useState(0);
  const [ttsDuration, setTtsDuration] = useState(0);
  const [ttsActiveText, setTtsActiveText] = useState("");
  const [isTtsPanelCollapsed, setIsTtsPanelCollapsed] = useState(true);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [ttsPlaybackRate, setTtsPlaybackRate] = useState(1);
  const [isTtsMuted, setIsTtsMuted] = useState(false);
  const [sttModel, setSttModel] = useState<SttModel>("local-base");
   const [selectedImage, setSelectedImage] = useState<string | null>(null);
   const [isImageModalOpen, setIsImageModalOpen] = useState(false);
   const [initializing, setInitializing] = useState(true);
  const [isStartingNewChat, setIsStartingNewChat] = useState(false);
  const [chatModel, setChatModel] = useState<string | null>(null);
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsUiTickRef = useRef(0);
  const ttsSegmentsRef = useRef<PreparedTtsSegment[]>([]);
  const ttsSeekTargetRef = useRef<number | null>(null);
  const ttsShouldAutoplayRef = useRef(false);
  const lastScrollTimeRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionChangeRef = useRef(false);

  const resetTtsState = useCallback(() => {
    ttsSegmentsRef.current.forEach((segment) => URL.revokeObjectURL(segment.audioUrl));
    ttsSegmentsRef.current = [];
    ttsSeekTargetRef.current = null;
    ttsShouldAutoplayRef.current = false;
    setSpeakingMessageId(null);
    setTtsSegments([]);
    setTtsSegmentIndex(0);
    setTtsCurrentTime(0);
    setTtsDuration(0);
    setTtsActiveText("");
    setIsTtsPlaying(false);
    setTtsAudioUrl(null);
  }, []);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "00:00";
    }
    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const secs = (total % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const stopCurrentTtsAudio = useCallback(() => {
    const audio = ttsAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  const handleTtsSeek = useCallback((nextTime: number) => {
    const boundedTime = Math.min(Math.max(nextTime, 0), ttsDuration || 0);
    if (!ttsSegments.length) {
      setTtsCurrentTime(boundedTime);
      return;
    }

    let accumulated = 0;
    let targetIndex = 0;
    let targetOffset = boundedTime;

    for (let index = 0; index < ttsSegments.length; index += 1) {
      const segmentDuration = ttsSegments[index].duration;
      if (boundedTime <= accumulated + segmentDuration || index === ttsSegments.length - 1) {
        targetIndex = index;
        targetOffset = Math.min(Math.max(boundedTime - accumulated, 0), segmentDuration || 0);
        break;
      }
      accumulated += segmentDuration;
    }

    const shouldResume = !!ttsAudioRef.current && !ttsAudioRef.current.paused;
    ttsShouldAutoplayRef.current = shouldResume;
    setTtsCurrentTime(boundedTime);

    if (targetIndex === ttsSegmentIndex && ttsAudioRef.current) {
      ttsAudioRef.current.currentTime = targetOffset;
      if (shouldResume) {
        ttsAudioRef.current.play().catch(() => undefined);
      }
      return;
    }

    ttsSeekTargetRef.current = targetOffset;
    setTtsSegmentIndex(targetIndex);
  }, [ttsDuration, ttsSegmentIndex, ttsSegments]);

  const handleOpenImage = useCallback((image: string) => {
    setSelectedImage(image);
    setIsImageModalOpen(true);
  }, []);

  const handleCloseImage = useCallback(() => {
    setIsImageModalOpen(false);
    setSelectedImage(null);
  }, []);

  const refreshSessionHistory = useCallback(async () => {
    if (!materialId) {
      return;
    }
    setIsHistoryLoading(true);
    try {
      const result = await listChatSessions(materialId);
      setSessionHistory(result.sessions);
    } catch {
      setSessionHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [materialId]);

  const loadSessionHistory = useCallback(async (nextSessionId: string) => {
    const detail = await getChatSession(nextSessionId);
    setSessionId(detail.session.id);
    setMessages(detail.messages);
    setInput("");
    setImages([]);
    stopCurrentTtsAudio();
    resetTtsState();
    window.localStorage.setItem(getChatSessionStorageKey(materialId), detail.session.id);
    sessionChangeRef.current = true;
    await refreshSessionHistory();
  }, [materialId, refreshSessionHistory, resetTtsState, stopCurrentTtsAudio]);

  useEffect(() => {
    if (!materialId) return;
    let cancelled = false;

    const initializeSession = async () => {
      try {
        const storageKey = getChatSessionStorageKey(materialId);
        const savedSessionId = window.localStorage.getItem(storageKey);

        if (savedSessionId) {
          try {
            const detail = await getChatSession(savedSessionId);
            if (!cancelled) {
              setSessionId(detail.session.id);
              setMessages(detail.messages);
              sessionChangeRef.current = true;
              return;
            }
          } catch {
            window.localStorage.removeItem(storageKey);
          }
        }

        const session = await createChatSession(materialId);
        if (cancelled) return;
        setSessionId(session.id);
        setMessages([]);
        sessionChangeRef.current = true;
      } catch {
        if (!cancelled) {
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          void refreshSessionHistory();
        }
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    void initializeSession();

    return () => {
      cancelled = true;
    };
  }, [materialId, refreshSessionHistory]);

  useEffect(() => {
    const savedModel = localStorage.getItem("chat_model");
    if (savedModel) setChatModel(savedModel);
  }, []);

  useEffect(() => {
    if (!materialId || !sessionId) {
      return;
    }
    window.localStorage.setItem(getChatSessionStorageKey(materialId), sessionId);
  }, [materialId, sessionId]);

  useEffect(() => {
    const scrollToBottom = () => {
      if (!messagesEndRef.current) return;

      const container = messagesEndRef.current.parentElement;
      if (container) {
        // Always scroll to bottom on session change/initial load
        if (sessionChangeRef.current) {
          sessionChangeRef.current = false;
          container.scrollTop = container.scrollHeight;
          return;
        }

        // During streaming, only scroll if user is near bottom
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isNearBottom) {
          container.scrollTop = container.scrollHeight;
        }
      }
    };

    const now = Date.now();
    // Throttle scroll to max once every 100ms
    if (now - lastScrollTimeRef.current > 100) {
      scrollToBottom();
      lastScrollTimeRef.current = now;
    } else {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(scrollToBottom, 100);
    }

    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [messages]);

  useEffect(() => {
    ttsSegmentsRef.current = ttsSegments;
  }, [ttsSegments]);

  useEffect(() => {
    return () => {
      stopCurrentTtsAudio();
      ttsSegmentsRef.current.forEach((segment) => URL.revokeObjectURL(segment.audioUrl));
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [stopCurrentTtsAudio]);

  useEffect(() => {
    const activeSegment = ttsSegments[ttsSegmentIndex];
    setTtsAudioUrl(activeSegment ? activeSegment.audioUrl : null);
  }, [ttsSegments, ttsSegmentIndex]);

  async function handleNewChat() {
    if (!materialId || isStartingNewChat) {
      return;
    }

    setIsStartingNewChat(true);
    stopCurrentTtsAudio();
    resetTtsState();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    setIsTranscribing(false);

    try {
      const session = await createChatSession(materialId);
      setSessionId(session.id);
      setMessages([]);
      setInput("");
      setImages([]);
      sessionChangeRef.current = true;
      await refreshSessionHistory();
      
    } catch {
      alert("Không thể tạo đoạn chat mới");
    } finally {
      setIsStartingNewChat(false);
    }
  }

  async function handleOpenHistory() {
    setIsHistoryOpen(true);
    await refreshSessionHistory();
  }

  async function handleSelectSession(nextSessionId: string) {
    setHistoryActionId(nextSessionId);
    try {
      await loadSessionHistory(nextSessionId);
      setIsHistoryOpen(false);
    } catch {
      alert("Không thể tải lịch sử cuộc trò chuyện này");
    } finally {
      setHistoryActionId(null);
    }
  }

  async function confirmDeleteSession(sessionToDelete: ChatSession) {
    setHistoryActionId(sessionToDelete.id);
    try {
      await deleteChatSession(sessionToDelete.id);
      const storageKey = getChatSessionStorageKey(materialId);
      const isActiveSession = sessionId === sessionToDelete.id;

      if (isActiveSession) {
        stopCurrentTtsAudio();
        resetTtsState();
        window.localStorage.removeItem(storageKey);
        const newSession = await createChatSession(materialId);
        setSessionId(newSession.id);
        setMessages([]);
        setInput("");
        setImages([]);
        sessionChangeRef.current = true;
      }

      await refreshSessionHistory();
      setSessionPendingDelete(null);
    } catch {
      alert("Không thể xóa cuộc trò chuyện này");
    } finally {
      setHistoryActionId(null);
    }
  }

  async function confirmDeleteAllHistory() {
    setIsDeletingAllHistory(true);
    try {
      await deleteChatSessionsByMaterial(materialId);
      stopCurrentTtsAudio();
      resetTtsState();
      window.localStorage.removeItem(getChatSessionStorageKey(materialId));
      const newSession = await createChatSession(materialId);
      setSessionId(newSession.id);
      setMessages([]);
      setInput("");
      setImages([]);
      sessionChangeRef.current = true;
      await refreshSessionHistory();
      setIsDeleteAllDialogOpen(false);
    } catch {
      alert("Không thể xóa toàn bộ lịch sử chatbot");
    } finally {
      setIsDeletingAllHistory(false);
    }
  }

  useEffect(() => {
    if (!ttsAudioUrl || !ttsAudioRef.current) {
      return;
    }
    if (!ttsShouldAutoplayRef.current) {
      return;
    }
    ttsAudioRef.current.play().catch(() => undefined);
  }, [ttsAudioUrl]);

  useEffect(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.playbackRate = ttsPlaybackRate;
      ttsAudioRef.current.muted = isTtsMuted;
    }
  }, [ttsPlaybackRate, isTtsMuted, ttsAudioUrl]);

  const handleToggleSpeak = useCallback(async (messageId: string, content: string) => {
    if (speakingMessageId === messageId) {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
      }
      resetTtsState();
      return;
    }

    try {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
      }
      resetTtsState();
      setSpeakingMessageId(messageId);
      setTtsActiveText(content);
      setIsTtsPanelCollapsed(false);
      ttsShouldAutoplayRef.current = true;
      const textSegments = splitTextForTts(content);
      const preparedSegments: PreparedTtsSegment[] = [];
      for (const segment of textSegments) {
        const audioBlob = await synthesizeChatSpeech(segment.text, ttsLang);
        const audioUrl = URL.createObjectURL(audioBlob);
        const duration = await getAudioDurationFromUrl(audioUrl);
        preparedSegments.push({ text: segment.text, audioUrl, duration });
      }

      if (preparedSegments.length === 0) {
        throw new Error("No TTS segments generated");
      }

      setTtsSegments(preparedSegments);
      setTtsSegmentIndex(0);
      setTtsCurrentTime(0);
      setTtsDuration(preparedSegments.reduce((sum, segment) => sum + segment.duration, 0));
    } catch {
      setSpeakingMessageId((prev) => (prev === messageId ? null : prev));
      alert("Không thể tạo âm thanh TTS");
    }
  }, [resetTtsState, speakingMessageId, ttsLang]);

   async function handleSend(event: FormEvent) {
     event.preventDefault();
     if (!sessionId || (!input.trim() && images.length === 0)) return;

     const currentImages = [...images];
     const userMessage: ChatMessage = {
       id: `tmp-${Date.now()}`,
       role: "user",
       session_id: sessionId,
       message: input || "[Hình ảnh]",
       citations: [],
       created_at: new Date().toISOString(),
       images: currentImages,
     };

     setMessages((prev) => [...prev, userMessage]);
     const question = input;
     setInput("");
     setImages([]);
     setLoading(true);

     try {
       if (isWebSearchEnabled) {
         const result = await webSearch(sessionId, question, useGoogleSearch);
         if (result) {
           const searchMessage: ChatMessage = {
             id: `web-search-${Date.now()}`,
             role: "assistant",
             session_id: sessionId,
             message: result.answer,
             citations: Array.isArray(result.citations) ? result.citations : [],
             created_at: new Date().toISOString(),
             model_used: result.model,
             fallback_applied: result.search_provider !== "google_search",
             search_results: {
               sources: Array.isArray(result.sources) ? result.sources : [],
               search_provider: result.search_provider,
               search_queries: result.search_queries,
             },
             is_web_search: true,
           };
           setMessages((prev) => [...prev, searchMessage]);
         }
       } else {
         setMessages((prev) => [
           ...prev,
           {
             id: `tmp-bot-${Date.now()}`,
             role: "assistant",
             session_id: sessionId,
             message: "",
             citations: [],
             created_at: new Date().toISOString(),
             reasoning_details: reasoningEnabled ? { reasoning: "" } : null
           } as ChatMessage,
         ]);

         await streamChatMessage(
           sessionId,
           question,
           (chunk) => {
             setMessages((prev) => {
               const next = [...prev];
               const last = { ...next[next.length - 1] };
               if (chunk.content) {
                 last.message = (last.message || "") + chunk.content;
               }
               if (chunk.reasoning && reasoningEnabled) {
                 last.reasoning_details = {
                   reasoning: (last.reasoning_details?.reasoning || "") + chunk.reasoning
                 };
               }
               if (Array.isArray(chunk.citations)) {
                 last.citations = chunk.citations;
               }
               // Handle model information from the done chunk
               if (chunk.model) {
                 last.model_used = chunk.model;
               }
               next[next.length - 1] = last;
               return next;
             });
           },
           currentImages,
           {
             model: chatModel,
             reasoningEnabled,
           }
         );
       }
     } catch (err: any) {
       console.error(err);
       alert(err.message || "Đã xảy ra lỗi trong quá trình tìm kiếm!");
     } finally {
       setLoading(false);
       
     }
   }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    let addedCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        if (images.length + addedCount >= 5) {
          alert("Không thể tải lên quá 5 hình ảnh!");
          break;
        }
        addedCount++;
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setImages((prev) => {
                if (prev.length >= 5) return prev;
                return [...prev, event.target!.result as string];
              });
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    let addedCount = 0;
    
    for (let i = 0; i < files.length; i++) {
      if (images.length + addedCount >= 5) {
        alert("Không thể tải lên quá 5 hình ảnh!");
        break;
      }
      addedCount++;
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImages((prev) => {
            if (prev.length >= 5) return prev;
            return [...prev, event.target!.result as string];
          });
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      alert("Trình duyệt không hỗ trợ ghi âm");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        if (!blob.size) {
          return;
        }

        setIsTranscribing(true);
        try {
          const result = await transcribeChatAudio(blob, sttModel);
          setInput((prev) => (prev.trim() ? `${prev.trim()} ${result.text}` : result.text));
        } catch {
          alert("Không thể chuyển giọng nói thành văn bản");
        } finally {
          setIsTranscribing(false);
          setIsRecording(false);
          mediaRecorderRef.current = null;
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      alert("Không thể truy cập microphone");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-[calc(100vh-9rem)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <Link href={`/materials/${materialId}`} className="hover:text-brand-600 transition-colors no-underline text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Quay lại
            </span>
          </Link>
          <span>/</span>
          <span className="text-[var(--text-secondary)] font-medium flex items-center gap-1.5">
            <MessageSquareText className="w-4 h-4" />
            Chatbot AI
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenHistory}
            disabled={initializing}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-light)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <History className="w-3.5 h-3.5" />
            Lịch sử
          </button>
          <button
            type="button"
            onClick={handleNewChat}
            disabled={initializing || isStartingNewChat || loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStartingNewChat ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            New chat
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Online</span>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <Card className="flex-1 flex flex-col !p-0 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {initializing && <ChatSkeleton />}

          {!initializing && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center mb-4"
              >
                <Bot className="w-8 h-8 text-white" />
              </motion.div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Xin chào! 👋
              </h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-sm">
                Tôi là trợ lý AI. Hãy hỏi tôi bất kỳ câu hỏi nào về nội dung tài liệu này.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {[
                  "Tóm tắt nội dung chính",
                  "Giải thích khái niệm quan trọng",
                  "Cho ví dụ minh họa",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="
                      px-3 py-2 rounded-xl text-xs font-medium
                      bg-[var(--bg-secondary)] border border-[var(--border-light)]
                      text-[var(--text-secondary)] hover:text-brand-600
                      hover:border-brand-300 hover:bg-brand-50
                      transition-all duration-200 cursor-pointer
                    "
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, idx) => {
              const isStreamingPlaceholder = msg.role === "assistant" && loading && idx === messages.length - 1 && !msg.message.trim();
              return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div className={`
                  w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1
                  ${msg.role === "assistant"
                    ? "bg-gradient-to-br from-brand-500 to-accent-500"
                    : "bg-gradient-to-br from-emerald-500 to-emerald-600"
                  }
                `}>
                  {msg.role === "assistant" ? (
                    <Bot className="w-4 h-4 text-white" />
                  ) : (
                    <User className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Message bubble */}
                <div className={`
                  max-w-[85%] rounded-2xl px-4 py-3
                  ${msg.role === "user"
                    ? "bg-gradient-to-r from-brand-600 to-accent-500 text-white rounded-tr-sm"
                    : "bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] rounded-tl-sm"
                  }
                `}>
                   {msg.role === "assistant" && msg.reasoning_details && reasoningEnabled && (
                     <ReasoningBlock
                       isStreaming={loading && idx === messages.length - 1}
                       reasoning={msg.reasoning_details.reasoning || msg.reasoning_details.reasoning_content || JSON.stringify(msg.reasoning_details)}
                     />
                   )}
                   {msg.role === "user" ? (
                     <p className="text-sm leading-relaxed m-0 whitespace-pre-wrap">
                       {msg.message}
                     </p>
                   ) : (
                     isStreamingPlaceholder ? (
                       <div className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                         <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
                         <span>AI đang tạo câu trả lời...</span>
                       </div>
                     ) : (
                       <Markdown content={msg.message} />
                     )
                   )}

                   {/* Image preview */}
                   {msg.images && msg.images.length > 0 && (
                     <div className="flex flex-wrap gap-2 mt-2">
                       {msg.images.map((img, idx) => (
                         <img
                           key={idx}
                           src={img}
                           alt={`upload ${idx}`}
                           className="max-w-[200px] max-h-[200px] object-cover rounded-lg border border-[var(--border-light)] cursor-pointer hover:opacity-90"
                           loading="lazy"
                           decoding="async"
                           onClick={() => handleOpenImage(img)}
                         />
                       ))}
                     </div>
                   )}

                    {msg.role === "assistant" && !!msg.message.trim() && (
                      <div className="mt-2 flex items-center justify-between gap-2 overflow-hidden">
                        <div className="flex flex-wrap items-center gap-2">
                          {msg.model_used && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-brand-50/50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-900/50">
                              <Bot className="w-2.5 h-2.5" />
                              Model: {msg.model_used}
                            </span>
                          )}
                          {msg.fallback_applied && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200/50">
                              <AlertCircle className="w-2.5 h-2.5" />
                              Dự phòng
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleSpeak(msg.id, msg.message)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          aria-label={speakingMessageId === msg.id ? "Dừng đọc nội dung" : "Đọc nội dung"}
                        >
                          {speakingMessageId === msg.id ? (
                            <VolumeX className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                          {speakingMessageId === msg.id ? "Dừng" : "Nghe"}
                        </button>
                      </div>
                    )}

                  {/* Citations */}
                  {!msg.is_web_search && msg.citations?.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-white/20 space-y-1.5">
                      <p className="text-xs font-semibold flex items-center gap-1 opacity-80">
                        <FileText className="w-3 h-3" />
                        Nguồn tham khảo
                      </p>
                      {msg.citations.map((cit, cidx) => (
                        <div
                          key={cidx}
                          className={`
                            text-xs rounded-lg px-3 py-2
                            ${msg.role === "user"
                              ? "bg-white/15"
                              : "bg-[var(--bg-primary)] border border-[var(--border-default)]"
                            }
                          `}
                        >
                          <span className="font-medium">Chunk {cit.chunk_index + 1}: </span>
                          <span className="opacity-80">{String(cit.snippet ?? "Không có mô tả nguồn").slice(0, 120)}...</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Typing indicator */}
          {loading && messages.length > 0 && messages[messages.length - 1].role !== "assistant" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-[var(--border-light)] p-4 bg-[var(--bg-elevated)] flex flex-col">
          <AnimatePresence>
            {isWebSearchEnabled && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 rounded-xl bg-sky-50/80 dark:bg-sky-900/30 border border-sky-200/60 dark:border-sky-800 shadow-sm flex items-start gap-3 text-sm text-sky-800 dark:text-sky-200">
                  <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-800/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Globe className="w-4 h-4 text-sky-600 dark:text-sky-300" />
                  </div>
                  <div className="flex-1 mt-1">
                    <span className="font-semibold inline-block mr-1">Tìm kiếm Web đang hoạt động:</span> 
                    AI sẽ tra cứu thông tin mới nhất trên Internet để trả lời câu hỏi của bạn. Hệ thống sẽ <strong className="font-bold underline decoration-sky-300 underline-offset-2">không sử dụng</strong> dữ liệu từ học liệu (RAG).
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-3 flex items-center justify-end gap-3 flex-wrap">
            {isWebSearchEnabled && (
              <div className="flex items-center">
                <label className="text-xs text-[var(--text-tertiary)] mr-2">Tìm kiếm web</label>
                <select
                  value={useGoogleSearch ? "google" : "tavily"}
                  onChange={(e) => setUseGoogleSearch(e.target.value === "google")}
                  className="text-xs rounded-lg px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] focus:outline-none focus:border-brand-400"
                >
                  <option value="google">Google Search</option>
                  <option value="tavily">Tavily Search</option>
                </select>
              </div>
            )}
            <div className="flex items-center">
              <label className="text-xs text-[var(--text-tertiary)] mr-2">Ngôn ngữ TTS</label>
              <select
                value={ttsLang}
                onChange={(e) => setTtsLang(e.target.value)}
                className="text-xs rounded-lg px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] focus:outline-none focus:border-brand-400"
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="zh-CN">Chinese (CN)</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
              </select>
            </div>
            {(chatModel?.includes("minimax") || chatModel?.includes("deepseek") || chatModel?.includes("qwen")) && (
              <div className="flex items-center">
                <label className="text-xs text-[var(--text-tertiary)] mr-2 flex items-center gap-1" title="Bật tính năng Suy luận sâu">Suy luận sâu (Reasoning)</label>
                <button
                  type="button"
                  onClick={() => setReasoningEnabled(!reasoningEnabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${reasoningEnabled ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} style={{ transform: reasoningEnabled ? "translateX(18px)" : "translateX(2px)" }} />
                </button>
              </div>
            )}
            <div className="flex items-center">
              <label className="text-xs text-[var(--text-tertiary)] mr-2">Model STT</label>
            <select
              value={sttModel}
              onChange={(e) => setSttModel(e.target.value as SttModel)}
              disabled={isRecording || isTranscribing}
              className="
                text-xs rounded-lg px-2.5 py-1.5
                bg-[var(--bg-secondary)] border border-[var(--border-light)]
                text-[var(--text-primary)]
                focus:outline-none focus:border-brand-400
                disabled:opacity-60
              "
            >
              <option value="local-base">Local - Whisper base</option>
              <option value="local-small">Local - Whisper small</option>
              <option value="whisper-large-v3">Groq - whisper-large-v3</option>
              <option value="whisper-large-v3-turbo">Groq - whisper-large-v3-turbo</option>
            </select>
            </div>
          </div>
          <form onSubmit={handleSend} className="flex flex-col gap-3">
             {images.length > 0 && (
               <div className="flex items-center gap-2 flex-wrap">
                 {images.map((img, idx) => (
                   <div key={idx} className="relative group w-16 h-16 rounded-lg border border-[var(--border-light)] overflow-hidden">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img
                       src={img}
                       alt={`preview ${idx}`}
                       className="w-full h-full object-cover cursor-pointer"
                        loading="lazy"
                        decoding="async"
                        onClick={() => handleOpenImage(img)}
                     />
                     <button
                       type="button"
                       onClick={() => removeImage(idx)}
                       className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                     >
                       <X className="w-3 h-3" />
                     </button>
                   </div>
                 ))}
               </div>
             )}
            <div className="flex flex-1 items-end gap-3 w-full">
              <label className="mb-0 cursor-pointer flex-shrink-0">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={loading || isTranscribing || images.length >= 5}
                />
                <div className={`
                  w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                  transition-all duration-200 border border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]
                  ${(images.length >= 5 || loading) ? "opacity-50 cursor-not-allowed" : "hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50"}
                `}>
                  <ImageIcon className="w-5 h-5" />
                </div>
              </label>
              <div className="flex-1 min-w-0 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                rows={1}
                placeholder="Nhập câu hỏi về tài liệu..."
                className="
                  w-full px-4 py-3 rounded-xl resize-none
                  bg-[var(--bg-secondary)] border border-[var(--border-light)]
                  text-sm text-[var(--text-primary)]
                  placeholder:text-[var(--text-tertiary)]
                  focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                  transition-all duration-200
                  min-h-[44px] max-h-[120px]
                "
                style={{ height: "44px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "44px";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
              />
            </div>
            <motion.button
              type="button"
              onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
              disabled={loading || isTranscribing || !sessionId}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                transition-all duration-200 shadow-md cursor-pointer border
                ${isWebSearchEnabled 
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500 hover:shadow-blue-500/30" 
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-light)] hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/25"
                }
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
              title={isWebSearchEnabled ? "Tắt tìm kiếm trên web" : "Bật tìm kiếm trên web"}
            >
              <Globe className="w-5 h-5" />
            </motion.button>
            <motion.button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading || isTranscribing}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                text-white transition-all duration-200 shadow-md cursor-pointer border-0
                ${isRecording
                  ? "bg-gradient-to-r from-rose-500 to-red-500 hover:shadow-rose-500/30"
                  : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-emerald-500/30"
                }
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
            >
              {isTranscribing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isRecording ? (
                <Square className="w-4 h-4" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </motion.button>
            <motion.button
              type="submit"
              disabled={loading || isTranscribing || (!input.trim() && images.length === 0)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="
                w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                bg-gradient-to-r from-brand-600 to-accent-500 text-white
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200 shadow-md
                hover:shadow-lg hover:shadow-brand-500/25
                cursor-pointer border-0
              "
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </motion.button>
            </div>
          </form>
              {ttsAudioUrl && speakingMessageId && (
            <div className="mt-3 relative rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50/80 via-white to-brand-50/30 dark:border-brand-900/50 dark:from-brand-900/20 dark:to-[var(--bg-elevated)] p-4 shadow-md backdrop-blur-sm overflow-hidden transition-all duration-300">
              {/* Trang trí background pulse khi đang phát audio */}
              {!isTtsPanelCollapsed && ttsDuration > 0 && ttsCurrentTime > 0 && ttsCurrentTime < ttsDuration && (
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl animate-pulse pointer-events-none" />
              )}
              <audio
                ref={ttsAudioRef}
                src={ttsAudioUrl}
                controls={false}
                className="hidden"
                onLoadedMetadata={(e) => {
                  const audio = e.target as HTMLAudioElement;
                  if (ttsSeekTargetRef.current !== null) {
                    audio.currentTime = ttsSeekTargetRef.current;
                    ttsSeekTargetRef.current = null;
                  }
                }}
                onTimeUpdate={(e) => {
                  const audio = e.target as HTMLAudioElement;
                  const baseTime = getSegmentBaseTime(ttsSegments, ttsSegmentIndex);
                  setTtsCurrentTime(baseTime + (audio.currentTime || 0));
                }}
                onEnded={() => {
                  if (ttsSegmentIndex < ttsSegments.length - 1) {
                    ttsShouldAutoplayRef.current = true;
                    setTtsSegmentIndex((prev) => prev + 1);
                    return;
                  }
                  setIsTtsPlaying(false);
                  resetTtsState();
                }}
                onError={() => {
                  setIsTtsPlaying(false);
                  resetTtsState();
                }}
                onPlay={() => {
                  ttsShouldAutoplayRef.current = true;
                  setIsTtsPlaying(true);
                }}
                onPause={() => {
                  ttsShouldAutoplayRef.current = false;
                  setIsTtsPlaying(false);
                }}
              />
              <div className="mb-3 flex items-center justify-between text-xs text-[var(--text-secondary)] relative z-10">
                <div className="flex items-center gap-2">
                  <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-brand-100 text-brand-700 shadow-inner">
                    <Volume2 className="w-4 h-4" />
                  </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    Đang phát {Math.round((ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0) * 100)}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTtsPanelCollapsed((prev) => !prev)}
                  className="rounded-full border border-brand-200/60 bg-[var(--bg-elevated)]/90 px-3 py-1.5 font-medium text-[var(--text-secondary)] hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-700 hover:shadow-sm transition-all"
                >
                  {isTtsPanelCollapsed ? "Mở rộng" : "Thu gọn"}
                </button>
              </div>

              {isTtsPanelCollapsed ? (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-3 rounded-full border border-brand-200/50 bg-[var(--bg-elevated)]/90 p-2.5 shadow-sm backdrop-blur-md">
                    <button 
                      onClick={() => {
                        if (ttsAudioRef.current) {
                          if (isTtsPlaying) ttsAudioRef.current.pause();
                          else ttsAudioRef.current.play();
                        }
                      }}
                      className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-600 transition-all shadow-md active:scale-95"
                      aria-label={isTtsPlaying ? "Dừng" : "Phát"}
                    >
                      {isTtsPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-1 fill-current" />}
                    </button>
                    <div className="group relative h-9 min-w-0 flex-1">
                      <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-[var(--bg-tertiary)] shadow-inner ring-1 ring-brand-200/70" />
                      <div
                        className="absolute left-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-gradient-to-r from-brand-500 via-brand-600 to-accent-500 shadow-[0_0_12px_rgba(59,130,246,0.35)] transition-all duration-300 ease-out"
                        style={{ width: `${ttsDuration > 0 ? (ttsCurrentTime / ttsDuration) * 100 : 0}%` }}
                      />
                      <div
                        className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white bg-brand-600 shadow-md ring-2 ring-brand-200 transition-transform duration-150 group-hover:scale-110"
                        style={{ left: `calc(${ttsDuration > 0 ? (ttsCurrentTime / ttsDuration) * 100 : 0}% - 10px)` }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={ttsDuration || 0}
                        step={0.1}
                      value={Math.min(ttsCurrentTime, ttsDuration || 0)}
                      onChange={(e) => {
                        const nextTime = Number(e.target.value);
                        ttsUiTickRef.current = performance.now();
                        handleTtsSeek(nextTime);
                      }}
                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                        title="Tua âm thanh"
                      />
                    </div>
                    <button
                      onClick={() => setTtsPlaybackRate(r => r === 1 ? 1.25 : r === 1.25 ? 1.5 : r === 1.5 ? 2 : 1)}
                      className="px-2 py-1 text-[10px] font-bold rounded-md bg-brand-100 text-brand-800 hover:bg-brand-200 transition-colors"
                      title="Tốc độ phát"
                    >
                      {ttsPlaybackRate}x
                    </button>
                    <button
                      onClick={() => setIsTtsMuted(m => !m)}
                      className="p-1.5 rounded-md text-brand-700 hover:bg-brand-100 transition-colors"
                      title={isTtsMuted ? "Bật âm" : "Tắt âm"}
                    >
                      {isTtsMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
                    <span>{formatTime(ttsCurrentTime)}</span>
                    <span>{formatTime(ttsDuration)}</span>
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Custom Audio Player Controls */}
                  <div className="flex items-center gap-4 w-full bg-[var(--bg-elevated)]/90 border border-brand-200/50 p-2.5 rounded-full shadow-sm backdrop-blur-md mt-1">
                    <button 
                      onClick={() => {
                        if (ttsAudioRef.current) {
                          if (isTtsPlaying) ttsAudioRef.current.pause();
                          else ttsAudioRef.current.play();
                        }
                      }}
                      className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-600 transition-all shadow-md active:scale-95"
                      aria-label={isTtsPlaying ? "Dừng" : "Phát"}
                    >
                      {isTtsPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-1 fill-current" />}
                    </button>

                    <span className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums w-10 text-center">
                      {formatTime(ttsCurrentTime)}
                    </span>

                    <div className="relative flex-1 h-8 flex items-center group cursor-pointer">
                      {/* Base track */}
                      <div className="absolute w-full h-2 bg-brand-100 rounded-full shadow-inner" />
                      
                      {/* Fill track */}
                      <div 
                        className="absolute h-2 bg-gradient-to-r from-brand-400 to-brand-600 rounded-full shadow-sm"
                        style={{ width: `${ttsDuration > 0 ? (ttsCurrentTime / ttsDuration) * 100 : 0}%` }}
                      />
                      
                      {/* Invisible Input & Custom Thumb */}
                      <input
                        type="range"
                        min={0}
                        max={ttsDuration || 0}
                        step={0.1}
                        value={Math.min(ttsCurrentTime, ttsDuration || 0)}
                        onChange={(e) => {
                          const nextTime = Number(e.target.value);
                          ttsUiTickRef.current = performance.now();
                          handleTtsSeek(nextTime);
                        }}
                        className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                        title="Tua âm thanh"
                      />
                      <div 
                        className="absolute h-4 w-4 bg-[var(--bg-elevated)] border-[3px] border-brand-500 rounded-full shadow-md transition-transform duration-100 group-hover:scale-125 z-0"
                        style={{ left: `calc(${ttsDuration > 0 ? (ttsCurrentTime / ttsDuration) * 100 : 0}% - 8px)` }}
                      />
                    </div>

                    <span className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums w-10 text-center">
                      {formatTime(ttsDuration)}
                    </span>

                    <div className="flex items-center gap-1 border-l border-brand-200/50 pl-2">
                      <button
                        onClick={() => setTtsPlaybackRate(r => r === 1 ? 1.25 : r === 1.25 ? 1.5 : r === 1.5 ? 2 : 1)}
                        className="px-2 py-1 text-[10px] font-bold rounded-md bg-brand-100 text-brand-800 hover:bg-brand-200 transition-colors"
                        title="Tốc độ phát"
                      >
                        {ttsPlaybackRate}x
                      </button>
                      <button
                        onClick={() => setIsTtsMuted(m => !m)}
                        className="p-1.5 rounded-md text-brand-700 hover:bg-brand-100 transition-colors"
                        title={isTtsMuted ? "Bật âm" : "Tắt âm"}
                      >
                        {isTtsMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-brand-200/50 bg-[var(--bg-elevated)]/95 p-3.5 text-left text-[var(--text-primary)] shadow-sm backdrop-blur-md">
                    <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider font-bold text-[var(--text-secondary)]">
                      <span>Văn bản đang đọc</span>
                    </div>
                    <div className="pr-2 custom-scrollbar">
                      <TtsMarkdown
                        content={ttsActiveText}
                        progress={ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
           <p className="text-xs text-[var(--text-tertiary)] mt-2 text-center">
            {isWebSearchEnabled 
              ? "Trợ lý AI đang tìm kiếm Internet trực tiếp. Nhấn Mic để ghi âm, Enter để gửi, Shift+Enter để xuống dòng."
              : "Trợ lý AI trả lời dựa trên nội dung học liệu. Nhấn Mic để ghi âm, Enter để gửi, Shift+Enter để xuống dòng."}
          </p>
        </div>
      </Card>

      <Dialog open={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title="Lịch sử chatbot" maxWidth="lg">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Chọn cuộc trò chuyện cũ để mở lại hoặc xóa lịch sử của tài liệu này.
            </p>
            <button
              type="button"
              onClick={() => setIsDeleteAllDialogOpen(true)}
              disabled={isDeletingAllHistory || sessionHistory.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeletingAllHistory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Xóa toàn bộ
            </button>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {isHistoryLoading ? (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-[var(--border-light)] p-6 text-sm text-[var(--text-secondary)]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tải lịch sử...
              </div>
            ) : sessionHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border-light)] p-6 text-center text-sm text-[var(--text-secondary)]">
                Chưa có cuộc trò chuyện nào được lưu.
              </div>
            ) : (
              sessionHistory.map((session) => {
                const isActive = session.id === sessionId;
                const isBusy = historyActionId === session.id;
                return (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ${isActive ? "border-brand-300 bg-brand-50" : "border-[var(--border-light)] bg-[var(--bg-secondary)]"}`}
                  >
                    <button
                      type="button"
                      onClick={() => void handleSelectSession(session.id)}
                      disabled={isBusy}
                      className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                    >
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {session.session_title}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        Cập nhật: {formatVietnamDateTime(session.updated_at)}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      {isActive && <span className="rounded-full bg-brand-100 px-2 py-1 text-[10px] font-semibold text-brand-700">Hiện tại</span>}
                      <button
                        type="button"
                        onClick={() => setSessionPendingDelete(session)}
                        disabled={isBusy}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Xóa ${session.session_title}`}
                      >
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!sessionPendingDelete}
        onClose={() => {
          if (!historyActionId) {
            setSessionPendingDelete(null);
          }
        }}
        onConfirm={() => {
          if (sessionPendingDelete) {
            void confirmDeleteSession(sessionPendingDelete);
          }
        }}
        isLoading={!!sessionPendingDelete && historyActionId === sessionPendingDelete.id}
        tone="danger"
        title="Xóa cuộc trò chuyện?"
        description={sessionPendingDelete
          ? `Cuộc trò chuyện "${sessionPendingDelete.session_title}" sẽ bị xóa khỏi lịch sử của tài liệu này.`
          : ""}
        confirmLabel="Xóa cuộc trò chuyện"
        cancelLabel="Giữ lại"
      />

      <ConfirmDialog
        open={isDeleteAllDialogOpen}
        onClose={() => {
          if (!isDeletingAllHistory) {
            setIsDeleteAllDialogOpen(false);
          }
        }}
        onConfirm={() => void confirmDeleteAllHistory()}
        isLoading={isDeletingAllHistory}
        tone="danger"
        title="Xóa toàn bộ lịch sử?"
        description="Toàn bộ cuộc trò chuyện của chatbot trong học liệu này sẽ bị xóa. Phiên hiện tại cũng sẽ được làm mới lại."
        confirmLabel="Xóa toàn bộ"
        cancelLabel="Hủy"
      />

      {/* Image Modal */}
      {isImageModalOpen && selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={handleCloseImage}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleCloseImage}
              className="absolute -top-10 right-0 text-white hover:text-white/80 text-4xl font-bold"
              aria-label="Close"
            >
              &times;
            </button>
            <img
              src={selectedImage}
              alt="Full size preview"
              loading="lazy"
              decoding="async"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}


    </motion.div>
  );
}
