"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Sphere } from "@react-three/drei";
import { Bot as BotIcon, Send, X, Mic, Square, Loader2, Settings2 } from "lucide-react";
import * as THREE from "three";

import { sendMascotChatMessage, transcribeChatAudio } from "@/lib/api";

type MiniChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MASCOT_SESSION_STORAGE_KEY = "mascot-chat-session-id";

function Bot() {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (groupRef.current) {
      // Look at mouse
      const targetX = (state.pointer.x * 0.5);
      const targetY = (state.pointer.y * 0.5);
      
      groupRef.current.rotation.y += (targetX - groupRef.current.rotation.y) * 0.1;
      groupRef.current.rotation.x += (-targetY - groupRef.current.rotation.x) * 0.1;
      
      // Bounce faster when hovered
      const bounceSpeed = hovered ? 5 : 2;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * bounceSpeed) * 0.1;
    }
  });

  return (
    <group 
      ref={groupRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <Float floatIntensity={hovered ? 0.5 : 1.5} speed={hovered ? 5 : 2}>
        {/* Head */}
        <RoundedBox args={[1.2, 1, 1.2]} radius={0.3} smoothness={4}>
          <meshStandardMaterial color={hovered ? "#fbcfe8" : "#e0e7ff"} roughness={0.2} metalness={0.5} />
        </RoundedBox>

        {/* Visor / screen */}
        <RoundedBox args={[0.9, 0.4, 0.1]} position={[0, 0.1, 0.6]} radius={0.1} smoothness={4}>
          <meshStandardMaterial color="#1e1b4b" roughness={0.5} />
        </RoundedBox>

        {/* Eyes */}
        <Sphere args={[0.08, 16, 16]} position={[-0.2, 0.1, 0.65]}>
          <meshBasicMaterial color={hovered ? "#f472b6" : "#34d399"} />
        </Sphere>
        <Sphere args={[0.08, 16, 16]} position={[0.2, 0.1, 0.65]}>
          <meshBasicMaterial color={hovered ? "#f472b6" : "#34d399"} />
        </Sphere>

        {/* Antenna Stem */}
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        
        {/* Antenna Bulb */}
        <Sphere args={[0.15, 16, 16]} position={[0, 0.8, 0]}>
          <meshStandardMaterial color={hovered ? "#f472b6" : "#6366f1"} emissive={hovered ? "#f472b6" : "#6366f1"} emissiveIntensity={0.5} />
        </Sphere>

        {/* Left Ear/Dial */}
        <mesh position={[-0.65, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
          <meshStandardMaterial color="#818cf8" />
        </mesh>

        {/* Right Ear/Dial */}
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
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sttModel, setSttModel] = useState<"local-base" | "whisper-large-v3" | "whisper-large-v3-turbo">("local-base");
  const [mascotSessionId, setMascotSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<MiniChatMessage[]>([
    {
      role: "assistant",
      content: "Xin chào. Mình là mascot AI, bạn cần hỗ trợ gì hôm nay?",
    },
  ]);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    const setDefaultPosition = () => {
      const initialX = Math.max(viewportPadding, window.innerWidth - mascotSize - 24);
      const initialY = Math.max(viewportPadding, window.innerHeight - mascotSize - 24);
      setPosition({ x: initialX, y: initialY });
    };

    setDefaultPosition();
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) {
        return;
      }

      const maxX = Math.max(viewportPadding, window.innerWidth - mascotSize - viewportPadding);
      const maxY = Math.max(viewportPadding, window.innerHeight - mascotSize - viewportPadding);
      const nextX = Math.min(Math.max(viewportPadding, event.clientX - dragOffsetRef.current.x), maxX);
      const nextY = Math.min(Math.max(viewportPadding, event.clientY - dragOffsetRef.current.y), maxY);
      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleResize = () => {
      const maxX = Math.max(viewportPadding, window.innerWidth - mascotSize - viewportPadding);
      const maxY = Math.max(viewportPadding, window.innerHeight - mascotSize - viewportPadding);
      setPosition((prev) => ({
        x: Math.min(prev.x, maxX),
        y: Math.min(prev.y, maxY),
      }));
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("resize", handleResize);
    };
  }, [isDragging]);

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
    if (savedSttModel) {
      setSttModel(savedSttModel as any);
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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

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

  const handleMascotClick = () => {
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    setIsChatOpen((prev) => !prev);
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

        if (!blob.size) return;

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
    if (!trimmed || isSending) {
      return;
    }

    const userMessage: MiniChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsSending(true);

    try {
      const response = await sendMascotChatMessage(trimmed, mascotSessionId);
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

  const handleInputKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await handleSendMessage();
    }
  };

  return (
    <div className="fixed z-50" style={{ left: `${position.x}px`, top: `${position.y}px` }}>
      {isChatOpen && (
        <div
          className="absolute bottom-[140px] right-0 w-[320px] max-w-[calc(100vw-24px)] rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] shadow-2xl overflow-hidden"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-light)] bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <BotIcon className="w-4 h-4 text-brand-500" />
              Chat Mascot
            </div>
            <div className="flex items-center gap-1">
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

          {showSettings && (
            <div className="p-3 bg-[var(--bg-secondary)] border-b border-[var(--border-light)] space-y-2">
              <label className="text-xs font-medium text-[var(--text-secondary)] block">Model STT</label>
              <select
                value={sttModel}
                onChange={(e) => setSttModel(e.target.value as any)}
                className="w-full text-xs rounded-lg px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-light)] text-[var(--text-primary)] focus:outline-none focus:border-brand-400"
              >
                <option value="local-base">Local - Whisper base</option>
                <option value="whisper-large-v3">Groq - whisper-large-v3</option>
                <option value="whisper-large-v3-turbo">Groq - whisper-large-v3-turbo</option>
              </select>
            </div>
          )}

          <div ref={messagesRef} className="h-64 overflow-y-auto p-3 space-y-2 bg-[var(--bg-primary)]">
            {messages.map((msg, index) => (
              <div
                key={`${msg.role}-${index}`}
                className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "ml-auto bg-brand-600 text-white"
                    : "bg-[var(--bg-elevated)] border border-[var(--border-light)] text-[var(--text-primary)]"
                }`}
              >
                {msg.content}
              </div>
            ))}
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

          <div className="p-3 border-t border-[var(--border-light)] bg-[var(--bg-elevated)]">
            <div className="flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Nhập tin nhắn..."
                disabled={isRecording || isTranscribing}
                className="flex-1 h-10 px-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-brand-400 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isSending || isTranscribing}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
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
                disabled={isSending || isRecording || isTranscribing || !chatInput.trim()}
                className="w-10 h-10 rounded-lg bg-brand-600 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Gui tin nhan mascot"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`w-32 h-32 drop-shadow-2xl select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveMark}
        onClick={handleMascotClick}
        role="button"
        aria-label="Mascot AI có thể kéo thả"
        tabIndex={0}
      >
        <Canvas 
          camera={{ position: [0, 0, 4], fov: 45 }}
          dpr={[1, 1.5]}
          performance={{ min: 0.5 }}
        >
          <ambientLight intensity={1} />
          <directionalLight position={[5, 5, 5]} intensity={1.5} color="#ffffff" />
          <directionalLight position={[-5, -5, 2]} intensity={0.5} color="#ec4899" />
          <Bot />
        </Canvas>
      </div>
    </div>
  );
}
