"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { FormEvent, memo, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  MessageSquareText,
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
  Pause
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { ChatSkeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/ui/markdown";
import { TtsMarkdown } from "@/components/ui/tts-markdown";
import { createChatSession, sendChatMessage, synthesizeChatSpeech, transcribeChatAudio } from "@/lib/api";
import { markdownToPlainText } from "@/lib/tts";
import type { ChatMessage, SttModel } from "@/types";

const EMPTY_CHAT_SUGGESTIONS = [
  "Tóm tắt nội dung chính",
  "Giải thích khái niệm quan trọng",
  "Cho ví dụ minh họa",
];

type ChatMessageItemProps = {
  message: ChatMessage;
  isSpeaking: boolean;
  onToggleSpeak: (messageId: string, content: string) => void;
  onOpenImage: (image: string) => void;
};

const ChatMessageItem = memo(function ChatMessageItem({
  message,
  isSpeaking,
  onToggleSpeak,
  onOpenImage,
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
        {message.role === "user" ? (
          <p className="text-sm leading-relaxed m-0 whitespace-pre-wrap">
            {message.message}
          </p>
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

        {message.citations?.length > 0 && (
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
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [ttsLang, setTtsLang] = useState("vi");
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsCurrentTime, setTtsCurrentTime] = useState(0);
  const [ttsDuration, setTtsDuration] = useState(0);
  const [ttsActiveText, setTtsActiveText] = useState("");
  const [isTtsPanelCollapsed, setIsTtsPanelCollapsed] = useState(true);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [sttModel, setSttModel] = useState<SttModel>("local-base");
   const [selectedImage, setSelectedImage] = useState<string | null>(null);
   const [isImageModalOpen, setIsImageModalOpen] = useState(false);
   const [initializing, setInitializing] = useState(true);
  const [isStartingNewChat, setIsStartingNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsUiTickRef = useRef(0);

  const resetTtsState = useCallback(() => {
    setSpeakingMessageId(null);
    setTtsCurrentTime(0);
    setTtsDuration(0);
    setTtsActiveText("");
    setIsTtsPlaying(false);
    setTtsAudioUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
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

  const handleOpenImage = useCallback((image: string) => {
    setSelectedImage(image);
    setIsImageModalOpen(true);
  }, []);

  const handleCloseImage = useCallback(() => {
    setIsImageModalOpen(false);
    setSelectedImage(null);
  }, []);

  useEffect(() => {
    if (!materialId) return;
    let cancelled = false;
    createChatSession(materialId)
      .then((session) => {
        if (cancelled) return;
        setSessionId(session.id);
        setMessages([]);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setInitializing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [materialId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      stopCurrentTtsAudio();
      if (ttsAudioUrl) {
        URL.revokeObjectURL(ttsAudioUrl);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [ttsAudioUrl]);

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
      inputRef.current?.focus();
    } catch {
      alert("Không thể tạo đoạn chat mới");
    } finally {
      setIsStartingNewChat(false);
    }
  }

  useEffect(() => {
    if (!ttsAudioUrl || !ttsAudioRef.current) {
      return;
    }
    ttsAudioRef.current.play().catch(() => undefined);
  }, [ttsAudioUrl]);

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
      // Convert markdown to plain text so TTS reads the rendered content
      const plainText = markdownToPlainText(content);
      const audioBlob = await synthesizeChatSpeech(plainText, ttsLang);
      const audioUrl = URL.createObjectURL(audioBlob);
      setTtsAudioUrl(audioUrl);
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
       const assistantMessage = await sendChatMessage(sessionId, question, currentImages);
       setMessages((prev) => [...prev, assistantMessage]);
     } finally {
       setLoading(false);
       inputRef.current?.focus();
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
          inputRef.current?.focus();
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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-700">Online</span>
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
            {messages.map((msg) => (
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
                   {msg.role === "user" ? (
                     <p className="text-sm leading-relaxed m-0 whitespace-pre-wrap">
                       {msg.message}
                     </p>
                   ) : (
                     <Markdown content={msg.message} />
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

                    {msg.role === "assistant" && (
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {msg.fallback_applied && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <AlertCircle className="w-3 h-3" />
                            {`Đã chuyển sang model dự phòng: ${msg.model_used || "không xác định"}`}
                          </span>
                        )}
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
                  {msg.citations?.length > 0 && (
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
                          <span className="opacity-80">{cit.snippet.slice(0, 120)}...</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {loading && (
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
        <div className="border-t border-[var(--border-light)] p-4 bg-[var(--bg-elevated)]">
          <div className="mb-3 flex items-center justify-end gap-3 flex-wrap">
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
              <div className="mb-3 flex items-center justify-between text-xs text-[var(--text-secondary)] relative z-10">
                <div className="flex items-center gap-2">
                  <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-400 shadow-inner">
                    <Volume2 className="w-4 h-4" />
                  </span>
                  <span className="font-semibold text-brand-900 dark:text-brand-300">
                    Đang phát {Math.round((ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0) * 100)}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTtsPanelCollapsed((prev) => !prev)}
                  className="rounded-full border border-brand-200/60 bg-white/80 dark:bg-[var(--bg-elevated)] px-3 py-1.5 font-medium hover:bg-brand-50 hover:text-brand-700 hover:shadow-sm dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-900/50 transition-all"
                >
                  {isTtsPanelCollapsed ? "Mở rộng" : "Thu gọn"}
                </button>
              </div>

              {isTtsPanelCollapsed ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-brand-100/80 dark:bg-brand-900/30 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-400 via-brand-500 to-accent-500 transition-all duration-300 ease-out"
                    style={{ width: `${Math.round((ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0) * 100)}%` }}
                  />
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <audio
                    ref={ttsAudioRef}
                    src={ttsAudioUrl}
                    controls={false}
                    className="hidden"
                    onLoadedMetadata={(e) => setTtsDuration((e.target as HTMLAudioElement).duration || 0)}
                    onTimeUpdate={(e) => {
                      const now = performance.now();
                      if (now - ttsUiTickRef.current < 200) return;
                      ttsUiTickRef.current = now;
                      const audio = e.target as HTMLAudioElement;
                      setTtsCurrentTime(audio.currentTime || 0);
                      setTtsDuration(audio.duration || 0);
                    }}
                    onEnded={() => {
                      setIsTtsPlaying(false);
                      resetTtsState();
                    }}
                    onError={() => {
                      setIsTtsPlaying(false);
                      resetTtsState();
                    }}
                    onPlay={() => setIsTtsPlaying(true)}
                    onPause={() => setIsTtsPlaying(false)}
                  />

                  {/* Custom Audio Player Controls */}
                  <div className="flex items-center gap-4 w-full bg-white/60 dark:bg-black/30 border border-brand-200/50 dark:border-brand-800/50 p-2.5 rounded-full shadow-sm backdrop-blur-md mt-1">
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

                    <span className="text-xs font-semibold text-brand-700/80 dark:text-brand-300/80 tabular-nums w-10 text-center">
                      {formatTime(ttsCurrentTime)}
                    </span>

                    <div className="relative flex-1 h-8 flex items-center group cursor-pointer">
                      {/* Base track */}
                      <div className="absolute w-full h-2 bg-brand-100 dark:bg-brand-900/60 rounded-full shadow-inner" />
                      
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
                          if (ttsAudioRef.current) ttsAudioRef.current.currentTime = nextTime;
                          ttsUiTickRef.current = performance.now();
                          setTtsCurrentTime(nextTime);
                        }}
                        className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                        title="Tua âm thanh"
                      />
                      <div 
                        className="absolute h-4 w-4 bg-white border-[3px] border-brand-500 rounded-full shadow-md transition-transform duration-100 group-hover:scale-125 z-0"
                        style={{ left: `calc(${ttsDuration > 0 ? (ttsCurrentTime / ttsDuration) * 100 : 0}% - 8px)` }}
                      />
                    </div>

                    <span className="text-xs font-semibold text-brand-700/80 dark:text-brand-300/80 tabular-nums w-10 text-center">
                      {formatTime(ttsDuration)}
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl border border-brand-200/50 bg-white/80 dark:bg-black/40 p-3.5 text-left shadow-sm backdrop-blur-md">
                    <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider font-bold text-brand-600/80 dark:text-brand-400/80">
                      <span>Văn bản đang đọc</span>
                    </div>
                    <div className="max-h-[5.5rem] overflow-y-auto pr-2 custom-scrollbar">
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
            Trợ lý AI trả lời dựa trên nội dung học liệu. Nhấn Mic để ghi âm, Enter để gửi, Shift+Enter để xuống dòng.
          </p>
        </div>
      </Card>

      {/* Image Modal */}
      {isImageModalOpen && selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={handleCloseImage}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleCloseImage}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-4xl font-bold"
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
