"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Sphere } from "@react-three/drei";
import { Bot as BotIcon, Loader2, Mic, Send, Settings2, Square, Volume2, VolumeX, X, Image as ImageIcon } from "lucide-react";
import * as THREE from "three";

import { sendMascotChatMessage, synthesizeChatSpeech, transcribeChatAudio } from "@/lib/api";

type MiniChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
};

const MASCOT_SESSION_STORAGE_KEY = "mascot-chat-session-id";

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
  const [sttModel, setSttModel] = useState<"local-base" | "whisper-large-v3" | "whisper-large-v3-turbo">("local-base");
  const [ttsLang, setTtsLang] = useState("vi");

  const [mascotSessionId, setMascotSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<MiniChatMessage[]>([
    {
      role: "assistant",
      content: "Xin chÃ o. MÃ¬nh lÃ  AI Agent phá»¥c vá»¥ cho giÃ¡o dá»¥c, báº¡n cáº§n há»— trá»£ gÃ¬ hÃ´m nay?",
    },
  ]);

  const [speakingMessageKey, setSpeakingMessageKey] = useState<string | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsCurrentTime, setTtsCurrentTime] = useState(0);
  const [ttsDuration, setTtsDuration] = useState(0);
  const [ttsActiveText, setTtsActiveText] = useState("");
  const [isTtsPanelCollapsed, setIsTtsPanelCollapsed] = useState(true);

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 320, height: 400, corner: "br" as "tl" | "tr" | "bl" | "br" });
  const chatPanelRef = useRef<HTMLDivElement>(null);

  const messagesRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

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
  }, [isDragging, isResizing]);

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
      setSttModel(savedSttModel as "local-base" | "whisper-large-v3" | "whisper-large-v3-turbo");
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
      const audioBlob = await synthesizeChatSpeech(content, ttsLang);
      const audioUrl = URL.createObjectURL(audioBlob);
      setTtsAudioUrl(audioUrl);
    } catch {
      setSpeakingMessageKey((prev) => (prev === messageKey ? null : prev));
      alert("KhÃ´ng thá»ƒ táº¡o Ã¢m thanh TTS");
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      alert("TrÃ¬nh duyá»‡t khÃ´ng há»— trá»£ ghi Ã¢m");
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
          alert("KhÃ´ng thá»ƒ chuyá»ƒn giá»ng nÃ³i thÃ nh vÄƒn báº£n");
        } finally {
          setIsTranscribing(false);
          setIsRecording(false);
          mediaRecorderRef.current = null;
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      alert("KhÃ´ng thá»ƒ truy cáº­p microphone");
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
    const userMessage: MiniChatMessage = { role: "user", content: trimmed || "[HÃ¬nh áº£nh]", images: currentImages };
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
          content: "MÃ¬nh Ä‘ang gáº·p lá»—i káº¿t ná»‘i. Báº¡n thá»­ láº¡i sau Ã­t giÃ¢y nhÃ©.",
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
          alert("KhÃ´ng thá»ƒ táº£i lÃªn quÃ¡ 5 hÃ¬nh áº£nh!");
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
        alert("KhÃ´ng thá»ƒ táº£i lÃªn quÃ¡ 5 hÃ¬nh áº£nh!");
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

