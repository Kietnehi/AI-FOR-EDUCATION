"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Sphere } from "@react-three/drei";
import { Bot as BotIcon, Globe, Loader2, Mic, Plus, Send, Settings2, Square, Volume2, VolumeX, X, Image as ImageIcon, Play, Pause } from "lucide-react";
import * as THREE from "three";

import { sendMascotChatMessage, synthesizeChatSpeech, transcribeChatAudio } from "@/lib/api";
import { markdownToPlainText } from "@/lib/tts";
import { Markdown } from "@/components/ui/markdown";
import { TtsMarkdown } from "@/components/ui/tts-markdown";
import type { SttModel } from "@/types";

type MiniChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
};

const MASCOT_SESSION_STORAGE_KEY = "mascot-chat-session-id";
const STT_MODEL_OPTIONS: SttModel[] = [
  "local-base",
  "local-small",
  "whisper-large-v3",
  "whisper-large-v3-turbo",
];

function Bot() {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    const targetX = state.pointer.x * 0.5;
    const targetY = state.pointer.y * 0.5;

    groupRef.current.rotation.y += (targetX - groupRef.current.rotation.y) * 0.1;
    groupRef.current.rotation.x += (-targetY - groupRef.current.rotation.x) * 0.1;

    const bounceSpeed = hovered ? 5 : 2;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * bounceSpeed) * 0.1;
  });

  return (
    <group ref={groupRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <Float floatIntensity={hovered ? 0.5 : 1.5} speed={hovered ? 5 : 2}>
        <RoundedBox args={[1.2, 1, 1.2]} radius={0.3} smoothness={4}>
          <meshStandardMaterial color={hovered ? "#fbcfe8" : "#e0e7ff"} roughness={0.2} metalness={0.5} />
        </RoundedBox>

        <RoundedBox args={[0.9, 0.4, 0.1]} position={[0, 0.1, 0.6]} radius={0.1} smoothness={4}>
          <meshStandardMaterial color="#1e1b4b" roughness={0.5} />
        </RoundedBox>

        <Sphere args={[0.08, 16, 16]} position={[-0.2, 0.1, 0.65]}>
          <meshBasicMaterial color={hovered ? "#f472b6" : "#34d399"} />
        </Sphere>
        <Sphere args={[0.08, 16, 16]} position={[0.2, 0.1, 0.65]}>
          <meshBasicMaterial color={hovered ? "#f472b6" : "#34d399"} />
        </Sphere>

        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>

        <Sphere args={[0.15, 16, 16]} position={[0, 0.8, 0]}>
          <meshStandardMaterial
            color={hovered ? "#f472b6" : "#6366f1"}
            emissive={hovered ? "#f472b6" : "#6366f1"}
            emissiveIntensity={0.5}
          />
        </Sphere>

        <mesh position={[-0.65, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
          <meshStandardMaterial color="#818cf8" />
        </mesh>

        <mesh position={[0.65, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
          <meshStandardMaterial color="#818cf8" />
        </mesh>
      </Float>
    </group>
  );
}

export function FloatingMascot() {
  const mascotSize = 128;
  const viewportPadding = 8;

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(320);
  const [chatPanelHeight, setChatPanelHeight] = useState(400);

  const [chatInput, setChatInput] = useState("");
  const [chatImages, setChatImages] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [useGoogleSearch, setUseGoogleSearch] = useState(true);
  const [sttModel, setSttModel] = useState<SttModel>("local-base");
  const [ttsLang, setTtsLang] = useState("vi");

  const [mascotSessionId, setMascotSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<MiniChatMessage[]>([
    {
      role: "assistant",
      content: "Xin chào. Mình là AI Agent phục vụ cho giáo dục, bạn cần hỗ trợ gì hôm nay?",
    },
  ]);

  const [speakingMessageKey, setSpeakingMessageKey] = useState<string | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsCurrentTime, setTtsCurrentTime] = useState(0);
  const [ttsDuration, setTtsDuration] = useState(0);
  const [ttsActiveText, setTtsActiveText] = useState("");
  const [isTtsPanelCollapsed, setIsTtsPanelCollapsed] = useState(true);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [ttsPlaybackRate, setTtsPlaybackRate] = useState(1);
  const [isTtsMuted, setIsTtsMuted] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
   const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 320, height: 400, corner: "br" as "tl" | "tr" | "bl" | "br" });
  const chatPanelRef = useRef<HTMLDivElement>(null);

  const messagesRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsUiTickRef = useRef(0);

  const resetTtsState = () => {
    setSpeakingMessageKey(null);
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
  };

  const stopCurrentTtsAudio = () => {
    const audio = ttsAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

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

  const getApproxReadingSegment = (text: string, progress: number) => {
    if (!text) {
      return "";
    }
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "";
    }
    const ratio = Math.min(Math.max(progress, 0), 1);
    const index = Math.floor(normalized.length * ratio);
    const start = Math.max(0, index - 14);
    const end = Math.min(normalized.length, index + 34);
    return normalized.slice(start, end);
  };

  useEffect(() => {
    const initialX = Math.max(viewportPadding, window.innerWidth - mascotSize - 24);
    const initialY = Math.max(viewportPadding, window.innerHeight - mascotSize - 24);
    setPosition({ x: initialX, y: initialY });
  }, []);

  useEffect(() => {
    if (!isDragging && !isResizing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (isDragging) {
        const maxX = Math.max(viewportPadding, window.innerWidth - mascotSize - viewportPadding);
        const maxY = Math.max(viewportPadding, window.innerHeight - mascotSize - viewportPadding);
        const nextX = Math.min(Math.max(viewportPadding, event.clientX - dragOffsetRef.current.x), maxX);
        const nextY = Math.min(Math.max(viewportPadding, event.clientY - dragOffsetRef.current.y), maxY);
        setPosition({ x: nextX, y: nextY });
      }
      
      if (isResizing) {
        const deltaX = event.clientX - resizeStartRef.current.x;
        const deltaY = event.clientY - resizeStartRef.current.y;
        
        const minWidth = 280;
        const maxWidth = Math.min(800, window.innerWidth - 100);
        const minHeight = 350;
        const maxHeight = Math.min(700, window.innerHeight - 100);
        
        const corner = resizeStartRef.current.corner;
        let newWidth = resizeStartRef.current.width;
        let newHeight = resizeStartRef.current.height;
        
        if (corner === "br") {
          // Bottom-right: increase both
          newWidth = Math.min(Math.max(minWidth, resizeStartRef.current.width + deltaX), maxWidth);
          newHeight = Math.min(Math.max(minHeight, resizeStartRef.current.height + deltaY), maxHeight);
        } else if (corner === "bl") {
          // Bottom-left: decrease width, increase height
          newWidth = Math.min(Math.max(minWidth, resizeStartRef.current.width - deltaX), maxWidth);
          newHeight = Math.min(Math.max(minHeight, resizeStartRef.current.height + deltaY), maxHeight);
        } else if (corner === "tr") {
          // Top-right: increase width, decrease height
          newWidth = Math.min(Math.max(minWidth, resizeStartRef.current.width + deltaX), maxWidth);
          newHeight = Math.min(Math.max(minHeight, resizeStartRef.current.height - deltaY), maxHeight);
        } else if (corner === "tl") {
          // Top-left: decrease both
          newWidth = Math.min(Math.max(minWidth, resizeStartRef.current.width - deltaX), maxWidth);
          newHeight = Math.min(Math.max(minHeight, resizeStartRef.current.height - deltaY), maxHeight);
        }
        
        setChatPanelWidth(newWidth);
        setChatPanelHeight(newHeight);
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, isResizing]);

  useEffect(() => {
    const handleResize = () => {
      const maxX = Math.max(viewportPadding, window.innerWidth - mascotSize - viewportPadding);
      const maxY = Math.max(viewportPadding, window.innerHeight - mascotSize - viewportPadding);
      setPosition((prev) => ({
        x: Math.min(prev.x, maxX),
        y: Math.min(prev.y, maxY),
      }));
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, isChatOpen]);

  useEffect(() => {
    const savedSessionId = localStorage.getItem(MASCOT_SESSION_STORAGE_KEY);
    if (savedSessionId) {
      setMascotSessionId(savedSessionId);
    }
    const savedSttModel = localStorage.getItem("mascot-stt-model");
    if (savedSttModel && STT_MODEL_OPTIONS.includes(savedSttModel as SttModel)) {
      setSttModel(savedSttModel as SttModel);
    }
  }, []);

  useEffect(() => {
    if (mascotSessionId) {
      localStorage.setItem(MASCOT_SESSION_STORAGE_KEY, mascotSessionId);
    }
  }, [mascotSessionId]);

  useEffect(() => {
    localStorage.setItem("mascot-stt-model", sttModel);
  }, [sttModel]);

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

  useEffect(() => {
    if (!ttsAudioUrl || !ttsAudioRef.current) {
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

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Only capture left click
    if (event.button !== 0) return;
    
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    // Capture pointer to ensure we don't lose drag if moving over iframe or outside window
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMoveMark = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }
    const dx = Math.abs(event.clientX - dragStartRef.current.x);
    const dy = Math.abs(event.clientY - dragStartRef.current.y);
    if (dx > 3 || dy > 3) {
      hasMovedRef.current = true;
    }
  };

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>, corner: "tl" | "tr" | "bl" | "br") => {
    event.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      width: chatPanelWidth,
      height: chatPanelHeight,
      corner,
    };
  };

  const handleMascotClick = () => {
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    setIsChatOpen((prev) => !prev);
  };

  const handleToggleSpeak = async (messageKey: string, content: string) => {
    if (speakingMessageKey === messageKey) {
      stopCurrentTtsAudio();
      resetTtsState();
      return;
    }

    try {
      stopCurrentTtsAudio();
      resetTtsState();
      setSpeakingMessageKey(messageKey);
      setTtsActiveText(content);
      setIsTtsPanelCollapsed(true);
      // Convert markdown to plain text so TTS reads the rendered content
      const plainText = markdownToPlainText(content);
      const audioBlob = await synthesizeChatSpeech(plainText, ttsLang);
      const audioUrl = URL.createObjectURL(audioBlob);
      setTtsAudioUrl(audioUrl);
    } catch {
      setSpeakingMessageKey((prev) => (prev === messageKey ? null : prev));
      alert("Không thể tạo âm thanh TTS");
    }
  };

  const startRecording = async () => {
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
          setChatInput((prev) => (prev.trim() ? `${prev.trim()} ${result.text}` : result.text));
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
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSendMessage = async () => {
    const trimmed = chatInput.trim();
    if ((!trimmed && chatImages.length === 0) || isSending) {
      return;
    }

    const currentImages = [...chatImages];
    const userMessage: MiniChatMessage = { role: "user", content: trimmed || "[Hình ảnh]", images: currentImages };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatImages([]);
    setIsSending(true);

    try {
      const response = await sendMascotChatMessage(trimmed, mascotSessionId, currentImages, {
        useWebSearch: isWebSearchEnabled,
        useGoogle: useGoogleSearch,
      });
      setMascotSessionId(response.session_id);
      setMessages((prev) => [...prev, { role: "assistant", content: response.message }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Mình đang gặp lỗi kết nối. Bạn thử lại sau ít giây nhé.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    let addedCount = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        if (chatImages.length + addedCount >= 5) {
          alert("Không thể tải lên quá 5 hình ảnh!");
          break;
        }
        addedCount++;
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setChatImages((prev) => {
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
      if (chatImages.length + addedCount >= 5) {
        alert("Không thể tải lên quá 5 hình ảnh!");
        break;
      }
      addedCount++;
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setChatImages((prev) => {
            if (prev.length >= 5) return prev;
            return [...prev, event.target!.result as string];
          });
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removeChatImage = (index: number) => {
    setChatImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleInputKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await handleSendMessage();
    }
  };

  const handleNewChat = () => {
    stopCurrentTtsAudio();
    resetTtsState();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    setIsTranscribing(false);
    setChatInput("");
    setChatImages([]);
    setMascotSessionId(undefined);
    localStorage.removeItem(MASCOT_SESSION_STORAGE_KEY);
    setMessages([
      {
        role: "assistant",
        content: "Xin chào. Mình là AI Agent phục vụ cho giáo dục, bạn cần hỗ trợ gì hôm nay?",
      },
    ]);
  };


  return (
    <div
      className="fixed z-50"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {isChatOpen && (
        <div
          className="absolute bottom-[148px] right-0"
          style={{
            width: `${chatPanelWidth}px`,
            maxWidth: `calc(100vw - 24px)`,
            height: `${chatPanelHeight}px`,
          }}
        >
          {/* Main chat panel */}
          <div
            ref={chatPanelRef}
            className="w-full h-full rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] shadow-2xl flex flex-col overflow-hidden"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-light)] bg-[var(--bg-secondary)] flex-shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <BotIcon className="w-4 h-4 text-brand-500" />
                Chat Mascot
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="h-7 rounded-md px-2 inline-flex items-center justify-center gap-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                  onClick={handleNewChat}
                  disabled={isSending}
                  aria-label="Tạo cuộc trò chuyện mới"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New chat
                </button>
                <button
                  className={`h-7 rounded-md px-2 inline-flex items-center justify-center gap-1 text-xs transition-colors ${
                    isWebSearchEnabled
                      ? "bg-brand-100 text-brand-700"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                  }`}
                  onClick={() => setIsWebSearchEnabled((prev) => !prev)}
                  disabled={isSending}
                  aria-label={isWebSearchEnabled ? "Tắt tìm kiếm web cho mascot" : "Bật tìm kiếm web cho mascot"}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Search
                </button>
                <button
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${showSettings ? "bg-brand-100 text-brand-600" : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"}`}
                  onClick={() => setShowSettings(!showSettings)}
                  aria-label="Cài đặt chatbot"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <button
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                  onClick={() => setIsChatOpen(false)}
                  aria-label="Đóng khung chat mascot"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Settings panel */}
            {showSettings && (
              <div className="p-3 bg-[var(--bg-secondary)] border-b border-[var(--border-light)] space-y-2 flex-shrink-0">
                <label className="text-xs font-medium text-[var(--text-secondary)] block">Công cụ tìm kiếm web</label>
                <select
                  value={useGoogleSearch ? "google" : "tavily"}
                  onChange={(e) => setUseGoogleSearch(e.target.value === "google")}
                  className="w-full text-xs rounded-lg px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-light)] text-[var(--text-primary)] focus:outline-none focus:border-brand-400"
                >
                  <option value="google">Google Search (Nhanh)</option>
                  <option value="tavily">Tavily Search (Chi tiết)</option>
                </select>

                <label className="text-xs font-medium text-[var(--text-secondary)] block">Model STT</label>
                <select
                  value={sttModel}
                  onChange={(e) => setSttModel(e.target.value as SttModel)}
                  className="w-full text-xs rounded-lg px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-light)] text-[var(--text-primary)] focus:outline-none focus:border-brand-400"
                >
                  <option value="local-base">Local - Whisper base</option>
                  <option value="local-small">Local - Whisper small</option>
                  <option value="whisper-large-v3">Groq - whisper-large-v3</option>
                  <option value="whisper-large-v3-turbo">Groq - whisper-large-v3-turbo</option>
                </select>

                <label className="text-xs font-medium text-[var(--text-secondary)] block">Ngôn ngữ TTS</label>
                <select
                  value={ttsLang}
                  onChange={(e) => setTtsLang(e.target.value)}
                  className="w-full text-xs rounded-lg px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-light)] text-[var(--text-primary)] focus:outline-none focus:border-brand-400"
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
            )}

            {/* Messages area */}
            <div ref={messagesRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[var(--bg-primary)]" style={{ minHeight: 0 }}>
              {messages.map((msg, index) => {
                const messageKey = `${msg.role}-${index}`;
                return (
                  <div
                    key={messageKey}
                    className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "ml-auto bg-brand-600 text-white"
                        : "bg-[var(--bg-elevated)] border border-[var(--border-light)] text-[var(--text-primary)]"
                    }`}
                  >
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {msg.images.map((img, idx) => (
                            <div key={idx} className="w-16 h-16 rounded border border-white/20 overflow-hidden bg-black/10">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img}
                                alt={`msg img ${idx}`}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-80"
                                onClick={() => {
                                  setSelectedImage(img);
                                  setIsImageModalOpen(true);
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    {msg.role === "user" ? (
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <Markdown content={msg.content} />
                    )}
                    {msg.role === "assistant" && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleToggleSpeak(messageKey, msg.content)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          aria-label={speakingMessageKey === messageKey ? "Dừng đọc nội dung" : "Đọc nội dung"}
                        >
                          {speakingMessageKey === messageKey ? (
                            <VolumeX className="w-3 h-3" />
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                          {speakingMessageKey === messageKey ? "Dừng" : "Nghe"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {isSending && (
                <div className="max-w-[88%] rounded-xl px-3 py-2 text-sm border border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                  Đang trả lời...
                </div>
              )}
              {isTranscribing && (
                <div className="max-w-[88%] rounded-xl px-3 py-2 text-sm border border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Đang chuyển giọng nói...
                </div>
              )}
            </div>

            {/* TTS Panel */}
            {ttsAudioUrl && speakingMessageKey && (
              <div className="px-3 pb-3 pt-2 bg-[var(--bg-primary)] border-t border-[var(--border-light)] flex-shrink-0 w-full min-w-0">
                <div className="relative rounded-xl border border-[var(--border-light)] bg-gradient-to-br from-brand-50/80 via-[var(--bg-secondary)] to-brand-50/20 dark:from-brand-900/20 dark:to-[var(--bg-elevated)] p-3 shadow-md overflow-hidden transition-all duration-300 w-full min-w-0">
                  {/* Pulse Effect */}
                  {!isTtsPanelCollapsed && ttsDuration > 0 && ttsCurrentTime > 0 && ttsCurrentTime < ttsDuration && (
                    <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-brand-500/10 rounded-full blur-xl animate-pulse pointer-events-none" />
                  )}
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
                  <div className="mb-2 flex items-center justify-between text-[11px] text-slate-700 min-w-0 relative z-10">
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <span className="inline-flex flex-shrink-0 w-6 h-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 shadow-inner">
                        <Volume2 className="w-3.5 h-3.5" />
                      </span>
                      <span className="font-semibold text-slate-900 truncate block">
                        Đang phát: {Math.round((ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0) * 100)}%
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTtsPanelCollapsed((prev) => !prev)}
                      className="rounded-full flex-shrink-0 border border-brand-200/60 bg-white/90 px-2.5 py-1 font-medium text-slate-700 hover:text-brand-700 transform transition-all active:scale-95 ml-2 hover:shadow-sm"
                    >
                      {isTtsPanelCollapsed ? "Mở rộng" : "Thu gọn"}
                    </button>
                  </div>

                  {isTtsPanelCollapsed ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center gap-2 rounded-full border border-brand-200/60 bg-white/90 p-2 shadow-sm backdrop-blur-sm">
                        <button
                          onClick={() => {
                            if (ttsAudioRef.current) {
                              if (isTtsPlaying) ttsAudioRef.current.pause();
                              else ttsAudioRef.current.play();
                            }
                          }}
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-all shadow-md active:scale-95 hover:bg-brand-600"
                          aria-label={isTtsPlaying ? "Dừng" : "Phát"}
                        >
                          {isTtsPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />}
                        </button>
                        <div className="group relative h-8 min-w-0 flex-1">
                          <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-slate-200 shadow-inner ring-1 ring-brand-200/70" />
                          <div
                            className="absolute left-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-brand-500 via-brand-600 to-accent-500 shadow-[0_0_12px_rgba(59,130,246,0.35)] transition-all duration-300"
                            style={{ width: `${ttsDuration > 0 ? (ttsCurrentTime / ttsDuration) * 100 : 0}%` }}
                          />
                          <div
                            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-brand-600 shadow-md ring-2 ring-brand-200 transition-transform duration-150 group-hover:scale-110"
                            style={{ left: `calc(${ttsDuration > 0 ? (ttsCurrentTime / ttsDuration) * 100 : 0}% - 8px)` }}
                          />
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
                            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                            title="Tua âm thanh"
                          />
                        </div>
                        <button
                          onClick={() => setTtsPlaybackRate(r => r === 1 ? 1.25 : r === 1.25 ? 1.5 : r === 1.5 ? 2 : 1)}
                          className="px-1.5 py-1 text-[9px] font-bold rounded-md bg-brand-100 text-brand-800 hover:bg-brand-200 transition-colors"
                          title="Tốc độ phát"
                        >
                          {ttsPlaybackRate}x
                        </button>
                        <button
                          onClick={() => setIsTtsMuted(m => !m)}
                          className="p-1 rounded-md text-brand-700 hover:bg-brand-100 transition-colors"
                          title={isTtsMuted ? "Bật âm" : "Tắt âm"}
                        >
                          {isTtsMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-700 tabular-nums">
                        <span>{formatTime(ttsCurrentTime)}</span>
                        <span>{formatTime(ttsDuration)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-2">
                      {/* Custom Audio Player Controls */}
                      <div className="flex items-center gap-3 w-full bg-white/90 border border-brand-200/60 p-2 rounded-full shadow-sm backdrop-blur-sm">
                        <button 
                          onClick={() => {
                            if (ttsAudioRef.current) {
                              if (isTtsPlaying) ttsAudioRef.current.pause();
                              else ttsAudioRef.current.play();
                            }
                          }}
                          className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-600 transition-all shadow-md active:scale-95"
                          aria-label={isTtsPlaying ? "Dừng" : "Phát"}
                        >
                          {isTtsPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />}
                        </button>

                        <span className="text-[10px] font-semibold text-slate-700 tabular-nums">{formatTime(ttsCurrentTime)}</span>

                        <div className="relative flex-1 h-6 flex items-center group cursor-pointer">
                          {/* Base track */}
                          <div className="absolute w-full h-1.5 bg-brand-100 rounded-full shadow-inner" />
                          
                          {/* Fill track */}
                          <div 
                            className="absolute h-1.5 bg-gradient-to-r from-brand-400 to-brand-600 rounded-full shadow-sm"
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
                            className="absolute h-3.5 w-3.5 bg-white border-[3px] border-brand-500 rounded-full shadow-md transition-transform duration-100 group-hover:scale-125 z-0"
                            style={{ left: `calc(${ttsDuration > 0 ? (ttsCurrentTime / ttsDuration) * 100 : 0}% - 7px)` }}
                          />
                        </div>

                        <span className="text-[10px] font-semibold text-slate-700 tabular-nums">{formatTime(ttsDuration)}</span>
                        
                        <div className="flex items-center gap-1 border-l border-brand-200/50 pl-1">
                          <button
                            onClick={() => setTtsPlaybackRate(r => r === 1 ? 1.25 : r === 1.25 ? 1.5 : r === 1.5 ? 2 : 1)}
                            className="px-1.5 py-1 text-[9px] font-bold rounded-md bg-brand-100 text-brand-800 hover:bg-brand-200 transition-colors"
                            title="Tốc độ phát"
                          >
                            {ttsPlaybackRate}x
                          </button>
                          <button
                            onClick={() => setIsTtsMuted(m => !m)}
                            className="p-1 rounded-md text-brand-700 hover:bg-brand-100 transition-colors"
                            title={isTtsMuted ? "Bật âm" : "Tắt âm"}
                          >
                            {isTtsMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 w-full min-w-0 mt-3">
                        <div className="rounded-xl border border-brand-200/50 bg-white/95 p-2.5 text-left text-slate-900 w-full min-w-0 shadow-sm backdrop-blur-sm custom-scrollbar">
                          <TtsMarkdown 
                            content={ttsActiveText} 
                            progress={ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0} 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="p-3 border-t border-[var(--border-light)] bg-[var(--bg-elevated)] flex flex-col gap-2 flex-shrink-0 w-full min-w-0">
              {isWebSearchEnabled && (
                <div className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-[11px] text-brand-700">
                  Mascot đang ở chế độ tìm kiếm web.
                </div>
              )}
               {chatImages.length > 0 && (
                 <div className="flex items-center gap-2 flex-wrap pb-1">
                   {chatImages.map((img, idx) => (
                     <div key={idx} className="relative group w-12 h-12 rounded-lg border border-[var(--border-light)] overflow-hidden">
                       {/* eslint-disable-next-line @next/next/no-img-element */}
                       <img
                         src={img}
                         alt={`preview ${idx}`}
                         className="w-full h-full object-cover cursor-pointer"
                         onClick={() => {
                           setSelectedImage(img);
                           setIsImageModalOpen(true);
                         }}
                       />
                       <button
                         type="button"
                         onClick={() => removeChatImage(idx)}
                         className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                         <X className="w-2.5 h-2.5" />
                       </button>
                     </div>
                   ))}
                 </div>
               )}
              <div className="flex items-center gap-2">
                <label className="mb-0 cursor-pointer flex-shrink-0">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isSending || isRecording || isTranscribing || chatImages.length >= 5}
                  />
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                    transition-all duration-200 border border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]
                    ${(chatImages.length >= 5 || isSending) ? "opacity-50 cursor-not-allowed" : "hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50"}
                  `}>
                    <ImageIcon className="w-4 h-4" />
                  </div>
                </label>
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  onPaste={handlePaste}
                  placeholder="Nhập tin nhắn..."
                  disabled={isRecording || isTranscribing}
                  className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-brand-400 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isSending || isTranscribing}
                  className={`w-10 h-10 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                    isRecording
                      ? "bg-rose-500 text-white hover:bg-rose-600"
                      : "bg-emerald-500 text-white hover:bg-emerald-600"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isTranscribing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isRecording ? (
                    <Square className="w-3 h-3" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={isSending || isRecording || isTranscribing || (!chatInput.trim() && chatImages.length === 0)}
                  className="w-10 h-10 flex-shrink-0 rounded-lg bg-brand-600 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Gửi tin nhắn mascot"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Resize handles - 4 corners */}
          {/* Top-left */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, "tl")}
            className={`absolute -top-2 -left-2 w-5 h-5 cursor-nwse-resize transition-all rounded-tl-xl ${
              isResizing ? "bg-brand-400 opacity-100" : "opacity-30 hover:opacity-80 hover:bg-brand-300"
            }`}
            style={{ background: "linear-gradient(315deg, transparent 50%, #6366f1 50%)", zIndex: 20, touchAction: 'none' }}
            title="Kéo để thay đổi kích thước"
          />
          {/* Top-right */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, "tr")}
            className={`absolute -top-2 -right-2 w-5 h-5 cursor-nesw-resize transition-all rounded-tr-xl ${
              isResizing ? "bg-brand-400 opacity-100" : "opacity-30 hover:opacity-80 hover:bg-brand-300"
            }`}
            style={{ background: "linear-gradient(225deg, transparent 50%, #6366f1 50%)", zIndex: 20, touchAction: 'none' }}
            title="Kéo để thay đổi kích thước"
          />
          {/* Bottom-left */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, "bl")}
            className={`absolute -bottom-2 -left-2 w-5 h-5 cursor-nesw-resize transition-all rounded-bl-xl ${
              isResizing ? "bg-brand-400 opacity-100" : "opacity-30 hover:opacity-80 hover:bg-brand-300"
            }`}
            style={{ background: "linear-gradient(45deg, transparent 50%, #6366f1 50%)", zIndex: 20, touchAction: 'none' }}
            title="Kéo để thay đổi kích thước"
          />
          {/* Bottom-right */}
          <div
            onPointerDown={(e) => handleResizePointerDown(e, "br")}
            className={`absolute -bottom-2 -right-2 w-5 h-5 cursor-nwse-resize transition-all rounded-br-xl ${
              isResizing ? "bg-brand-400 opacity-100" : "opacity-30 hover:opacity-80 hover:bg-brand-300"
            }`}
            style={{ background: "linear-gradient(135deg, transparent 50%, #6366f1 50%)", zIndex: 20, touchAction: 'none' }}
            title="Kéo để thay đổi kích thước"
          />
        </div>
      )}

          {/* The Mascot */}
      <div
        className={`relative w-32 h-32 select-none ${isDragging ? "cursor-grabbing touch-none" : "cursor-grab touch-none"}`}
        onPointerDown={handlePointerDown}
        onClick={handleMascotClick}
        onPointerMove={handlePointerMoveMark}
        role="button"
        aria-label="Mascot AI có thể kéo thả"
        tabIndex={0}
      >
        <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 1.25]} performance={{ min: 0.5 }}
          style={{ pointerEvents: 'none' }}>
          <ambientLight intensity={1} />
          <directionalLight position={[5, 5, 5]} intensity={1.5} color="#ffffff" />
          <directionalLight position={[-5, -5, 2]} intensity={0.5} color="#ec4899" />
          <Bot />
         </Canvas>
       </div>

       {/* Image Modal */}
       {isImageModalOpen && selectedImage && (
         <div
           className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
           onClick={() => {
             setIsImageModalOpen(false);
             setSelectedImage(null);
           }}
         >
           <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
             <button
               onClick={() => {
                 setIsImageModalOpen(false);
                 setSelectedImage(null);
               }}
               className="absolute -top-10 right-0 text-white hover:text-gray-300 text-4xl font-bold"
               aria-label="Close"
             >
               &times;
             </button>
             <img
               src={selectedImage}
               alt="Full size preview"
               className="max-w-full max-h-[90vh] object-contain rounded-lg"
             />
           </div>
         </div>
       )}
     </div>
   );
 }
