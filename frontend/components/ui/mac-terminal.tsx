"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MacTerminalProps {
  commands?: { command: string; output: string | React.ReactNode; delay?: number }[];
  title?: string;
  className?: string;
  autoStart?: boolean;
}

export const MacTerminal: React.FC<MacTerminalProps> = ({
  commands = [
    { command: "ai-learning-studio init", output: "Initializing Multimodal RAG Engine...", delay: 500 },
    { command: "status check-models", output: "✓ Gemini 3.0 Flash: Online\n✓ ChromaDB Vector Store: Active\n✓ Whisper STT: Ready", delay: 800 },
    { command: "feature list", output: "• PDF to PPT Generation\n• Educational Podcasts\n• Interactive Minigames\n• 3D AI Assistant", delay: 1000 },
  ],
  title = "zsh — AI Terminal",
  className = "",
  autoStart = true,
}) => {
  const [history, setHistory] = useState<{ command: string; output: string | React.ReactNode }[]>([]);
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Kiểm tra nếu người dùng đang ở gần đáy (trong khoảng 20px)
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    setIsAutoScrolling(isAtBottom);
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (isAutoScrolling && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      if (behavior === "auto") {
        container.scrollTop = container.scrollHeight;
      } else {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth"
        });
      }
    }
  }, [isAutoScrolling]);

  const startNextCommand = useCallback(async () => {
    if (currentCommandIndex >= commands.length) return;

    setIsTyping(true);
    const cmd = commands[currentCommandIndex].command;

    for (let i = 0; i <= cmd.length; i++) {
      setDisplayText(cmd.slice(0, i));
      await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 50));
    }

    setTimeout(() => {
      setHistory((prev) => [
        ...prev,
        { command: cmd, output: commands[currentCommandIndex].output },
      ]);
      setDisplayText("");
      setIsTyping(false);
      setCurrentCommandIndex((prev) => prev + 1);
    }, 300);
  }, [commands, currentCommandIndex]);

  useEffect(() => {
    // Khi đang gõ chữ liên tục, dùng 'auto' để mượt hơn và không giật
    scrollToBottom(isTyping ? "auto" : "smooth");
  }, [history, displayText, isTyping, scrollToBottom]);

  useEffect(() => {
    if (!autoStart || currentCommandIndex >= commands.length) return;

    const timer = setTimeout(() => {
      startNextCommand();
    }, commands[currentCommandIndex].delay || 1000);

    return () => clearTimeout(timer);
  }, [currentCommandIndex, autoStart, commands, startNextCommand]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{ 
        backgroundColor: "var(--glass-bg)", 
        borderColor: "var(--glass-border)",
        boxShadow: "var(--shadow-lg), inset 0 0 0 1px rgba(255,255,255,0.1)"
      }}
      className={`relative w-full max-w-2xl mx-auto overflow-hidden rounded-2xl border backdrop-blur-xl ${className}`}
    >
      {/* Decorative top highlight for Dark mode */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

      {/* Terminal Header */}
      <div 
        style={{ 
          backgroundColor: "rgba(0,0,0,0.03)", 
          borderBottomColor: "var(--border-structural)" 
        }}
        className="flex items-center justify-between px-5 py-3.5 border-b select-none"
      >
        <div className="flex items-center space-x-2.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-inner relative group cursor-pointer">
             <div className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-inner relative group cursor-pointer">
             <div className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-inner relative group cursor-pointer">
             <div className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div 
          style={{ 
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono, monospace)"
          }}
          className="text-[11px] font-bold tracking-widest uppercase opacity-60"
        >
          {title}
        </div>
        <div className="w-12" />
      </div>

      {/* Terminal Body */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ 
          color: "var(--text-secondary)",
          background: "linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.01) 100%)"
        }}
        className="p-7 font-mono text-sm sm:text-[15px] h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        <div className="space-y-4">
          {history.map((item, idx) => (
            <div key={idx} className="animate-fade-in-up">
              <div className="flex items-start">
                <span className="text-emerald-500 font-bold mr-2.5 drop-shadow-sm">➜</span>
                <span style={{ color: "var(--text-primary)" }} className="font-bold opacity-90">~</span>
                <span style={{ color: "var(--text-primary)" }} className="ml-2.5 font-medium">{item.command}</span>
              </div>
              <div 
                style={{ color: "var(--text-secondary)" }} 
                className="mt-1.5 pl-8 leading-relaxed whitespace-pre-wrap opacity-85 border-l border-slate-200 dark:border-slate-800 ml-1.5"
              >
                {item.output}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start">
              <span className="text-emerald-500 font-bold mr-2.5 drop-shadow-sm">➜</span>
              <span style={{ color: "var(--text-primary)" }} className="font-bold">~</span>
              <span style={{ color: "var(--text-primary)" }} className="ml-2.5 font-medium">{displayText}</span>
              <motion.span
                animate={{ opacity: [1, 1, 0, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
                className="inline-block w-2 h-5 ml-1.5 bg-emerald-500 align-middle shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              />
            </div>
          )}

          {!isTyping && currentCommandIndex < commands.length && (
            <div className="flex items-start">
              <span className="text-emerald-500 font-bold mr-2.5 opacity-50">➜</span>
              <span style={{ color: "var(--text-primary)" }} className="font-bold opacity-30">~</span>
              <motion.span
                animate={{ opacity: [1, 1, 0, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
                style={{ backgroundColor: "var(--text-muted)", opacity: 0.3 }}
                className="inline-block w-2 h-5 ml-2.5 align-middle"
              />
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </motion.div>
  );
};
