"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  MessageSquareText,
  Send,
  Bot,
  User,
  Sparkles,
  FileText,
  Loader2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { ChatSkeleton } from "@/components/ui/skeleton";
import { createChatSession, getChatSession, sendChatMessage } from "@/lib/api";
import { ChatMessage } from "@/types";

export default function ChatbotPage() {
  const params = useParams<{ id: string }>();
  const materialId = params.id;

  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!materialId) return;
    createChatSession(materialId)
      .then(async (session) => {
        setSessionId(session.id);
        const detail = await getChatSession(session.id);
        setMessages(detail.messages);
      })
      .catch(() => undefined)
      .finally(() => setInitializing(false));
  }, [materialId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!sessionId || !input.trim()) return;

    const userMessage: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      session_id: sessionId,
      message: input,
      citations: [],
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const question = input;
    setInput("");
    setLoading(true);

    try {
      const assistantMessage = await sendChatMessage(sessionId, question);
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-emerald-700">Online</span>
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
            {messages.map((msg, idx) => (
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
                  max-w-[75%] rounded-2xl px-4 py-3
                  ${msg.role === "user"
                    ? "bg-gradient-to-r from-brand-600 to-accent-500 text-white rounded-tr-sm"
                    : "bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] rounded-tl-sm"
                  }
                `}>
                  <p className="text-sm leading-relaxed m-0 whitespace-pre-wrap">
                    {msg.message}
                  </p>

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
                              : "bg-brand-50 border border-brand-100"
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
          <form onSubmit={handleSend} className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
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
              type="submit"
              disabled={loading || !input.trim()}
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
          </form>
          <p className="text-xs text-[var(--text-tertiary)] mt-2 text-center">
            Trợ lý AI trả lời dựa trên nội dung học liệu. Nhấn Enter để gửi, Shift+Enter để xuống dòng.
          </p>
        </div>
      </Card>
    </motion.div>
  );
}
