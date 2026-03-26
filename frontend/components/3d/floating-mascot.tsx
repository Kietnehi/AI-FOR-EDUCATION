"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Sphere } from "@react-three/drei";
import { Bot as BotIcon, Loader2, Mic, Plus, Send, Settings2, Square, Volume2, VolumeX, X, Image as ImageIcon } from "lucide-react";
import * as THREE from "three";

import { sendMascotChatMessage, synthesizeChatSpeech, transcribeChatAudio } from "@/lib/api";
import { markdownToPlainText } from "@/lib/tts";
import { Markdown } from "@/components/ui/markdown";
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

    const handleMouseMove = (event: MouseEvent) => {
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
        
        const minWidth = 250;
        const maxWidth = Math.min(800, window.innerWidth - 100);
        const minHeight = 300;
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

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
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

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
  };

  const handleMouseMoveMark = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }
    const dx = Math.abs(event.clientX - dragStartRef.current.x);
    const dy = Math.abs(event.clientY - dragStartRef.current.y);
    if (dx > 3 || dy > 3) {
      hasMovedRef.current = true;
    }
  };

  const handleResizeMouseDown = (event: React.MouseEvent<HTMLDivElement>, corner: "tl" | "tr" | "bl" | "br") => {
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
      const response = await sendMascotChatMessage(trimmed, mascotSessionId, currentImages);
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
              <div className="px-3 pb-3 pt-2 bg-[var(--bg-primary)] border-t border-[var(--border-light)] flex-shrink-0">
                <div className="rounded-xl border border-brand-200/60 bg-gradient-to-br from-brand-50/80 to-white p-2.5 shadow-sm">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                        <Volume2 className="w-3 h-3" />
                      </span>
                      <span className="font-medium">Đang phát TTS: {Math.round((ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0) * 100)}%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTtsPanelCollapsed((prev) => !prev)}
                      className="rounded-full border border-brand-200 bg-white px-2 py-0.5 font-medium hover:bg-brand-50 hover:text-brand-700 transition-colors"
                    >
                      {isTtsPanelCollapsed ? "Hiện" : "Ẩn"}
                    </button>
                  </div>

                  <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all"
                      style={{ width: `${Math.round((ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0) * 100)}%` }}
                    />
                  </div>

                  <audio
                    ref={ttsAudioRef}
                    src={ttsAudioUrl}
                    controls={!isTtsPanelCollapsed}
                    className={isTtsPanelCollapsed ? "hidden" : "w-full h-8"}
                    onLoadedMetadata={(e) => setTtsDuration((e.target as HTMLAudioElement).duration || 0)}
                    onTimeUpdate={(e) => {
                      const now = performance.now();
                      if (now - ttsUiTickRef.current < 200) {
                        return;
                      }
                      ttsUiTickRef.current = now;
                      const audio = e.target as HTMLAudioElement;
                      setTtsCurrentTime(audio.currentTime || 0);
                      setTtsDuration(audio.duration || 0);
                    }}
                    onEnded={() => resetTtsState()}
                    onError={() => resetTtsState()}
                  />

                  <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>{formatTime(ttsCurrentTime)} / {formatTime(ttsDuration)}</span>
                    <span>Tiến độ: {Math.round((ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0) * 100)}%</span>
                  </div>

                  {!isTtsPanelCollapsed && (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={ttsDuration || 0}
                        step={0.1}
                        value={Math.min(ttsCurrentTime, ttsDuration || 0)}
                        onChange={(e) => {
                          const nextTime = Number(e.target.value);
                          if (ttsAudioRef.current) {
                            ttsAudioRef.current.currentTime = nextTime;
                          }
                          ttsUiTickRef.current = performance.now();
                          setTtsCurrentTime(nextTime);
                        }}
                        className="mt-1 w-full accent-brand-600"
                        aria-label="Thanh tua âm thanh"
                      />
                      <p className="mt-1 text-[11px] text-[var(--text-tertiary)] line-clamp-1">
                        Đoạn đang đọc: {getApproxReadingSegment(ttsActiveText, ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="p-3 border-t border-[var(--border-light)] bg-[var(--bg-elevated)] flex flex-col gap-2 flex-shrink-0">
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
            onMouseDown={(e) => handleResizeMouseDown(e, "tl")}
            className={`absolute -top-2 -left-2 w-5 h-5 cursor-nwse-resize transition-all rounded-tl-xl ${
              isResizing ? "bg-brand-400 opacity-100" : "opacity-30 hover:opacity-80 hover:bg-brand-300"
            }`}
            style={{ background: "linear-gradient(315deg, transparent 50%, #6366f1 50%)", zIndex: 20 }}
            title="Kéo để thay đổi kích thước"
          />
          {/* Top-right */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, "tr")}
            className={`absolute -top-2 -right-2 w-5 h-5 cursor-nesw-resize transition-all rounded-tr-xl ${
              isResizing ? "bg-brand-400 opacity-100" : "opacity-30 hover:opacity-80 hover:bg-brand-300"
            }`}
            style={{ background: "linear-gradient(225deg, transparent 50%, #6366f1 50%)", zIndex: 20 }}
            title="Kéo để thay đổi kích thước"
          />
          {/* Bottom-left */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, "bl")}
            className={`absolute -bottom-2 -left-2 w-5 h-5 cursor-nesw-resize transition-all rounded-bl-xl ${
              isResizing ? "bg-brand-400 opacity-100" : "opacity-30 hover:opacity-80 hover:bg-brand-300"
            }`}
            style={{ background: "linear-gradient(45deg, transparent 50%, #6366f1 50%)", zIndex: 20 }}
            title="Kéo để thay đổi kích thước"
          />
          {/* Bottom-right */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, "br")}
            className={`absolute -bottom-2 -right-2 w-5 h-5 cursor-nwse-resize transition-all rounded-br-xl ${
              isResizing ? "bg-brand-400 opacity-100" : "opacity-30 hover:opacity-80 hover:bg-brand-300"
            }`}
            style={{ background: "linear-gradient(135deg, transparent 50%, #6366f1 50%)", zIndex: 20 }}
            title="Kéo để thay đổi kích thước"
          />
        </div>
      )}

      {/* The Mascot */}
      <div
        className={`relative w-32 h-32 select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={handleMouseDown}
        onClick={handleMascotClick}
        onMouseMove={handleMouseMoveMark}
        role="button"
        aria-label="Mascot AI có thể kéo thả"
        tabIndex={0}
      >
        <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 1.25]} performance={{ min: 0.5 }}>
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
