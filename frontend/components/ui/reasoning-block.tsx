"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, BrainCircuit } from "lucide-react";
import { Markdown } from "./markdown";

interface ReasoningBlockProps {
  reasoning: string;
  isStreaming?: boolean;
  className?: string;
}

export const ReasoningBlock: React.FC<ReasoningBlockProps> = ({ reasoning, isStreaming, className = "" }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!reasoning) return null;

  return (
    <div className={`mb-3 overflow-hidden rounded-xl border border-brand-200 bg-brand-50/30 dark:border-brand-900/40 dark:bg-brand-900/10 transition-all duration-300 ${className}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-brand-700 dark:text-brand-400 hover:bg-brand-100/50 dark:hover:bg-brand-900/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <BrainCircuit className={`h-4 w-4 ${isStreaming ? "animate-pulse text-brand-500" : ""}`} />
          <span>Quá trình suy luận</span>
          {isStreaming && (
            <span className="flex items-center gap-1">
              <span className="h-1 w-1 animate-bounce rounded-full bg-brand-500 [animation-delay:-0.3s]"></span>
              <span className="h-1 w-1 animate-bounce rounded-full bg-brand-500 [animation-delay:-0.15s]"></span>
              <span className="h-1 w-1 animate-bounce rounded-full bg-brand-500"></span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && isStreaming && <span className="text-[10px] font-normal opacity-60">Đang suy luận...</span>}
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>
      
      {isExpanded ? (
        <div className="px-3 pb-3 pt-1 border-t border-brand-100 dark:border-brand-900/30 animate-in fade-in slide-in-from-top-1 duration-200">
          <Markdown content={reasoning} />
        </div>
      ) : (
        <div className="px-3 pb-2 pt-1 text-[var(--text-tertiary)] opacity-70 italic text-[11px] cursor-pointer hover:opacity-100 transition-opacity" onClick={() => setIsExpanded(true)}>
          <div className="truncate">
             {reasoning.replace(/[#*`\n]/g, ' ').trim().slice(0, 120)}...
          </div>
        </div>
      )}
    </div>
  );
};
