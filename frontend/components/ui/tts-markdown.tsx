"use client";

import React, { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/ui/markdown";

interface TtsMarkdownProps {
  content: string;
  progress: number;
}

export function TtsMarkdown({ content, progress }: TtsMarkdownProps) {
  const hiddenRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  // Render markdown initially into hidden ref, then mark as rendered.
  useEffect(() => {
    // A small delay to ensure Markdown component has finished rendering its internal React tree.
    const timer = setTimeout(() => setRendered(true), 50);
    return () => clearTimeout(timer);
  }, [content]);

  useEffect(() => {
    if (!rendered || !hiddenRef.current || !visibleRef.current) return;

    // Reset visible HTML
    visibleRef.current.innerHTML = hiddenRef.current.innerHTML;

    // Find text nodes
    const textNodes: Text[] = [];
    const walk = document.createTreeWalker(visibleRef.current, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walk.nextNode())) {
      textNodes.push(node as Text);
    }

    // Calculate total words
    let totalWords = 0;
    textNodes.forEach((n) => {
      const words = n.nodeValue?.split(/\s+/) || [];
      totalWords += words.filter((w) => w.trim().length > 0).length;
    });

    const ratio = Math.min(Math.max(progress, 0), 1);
    const targetIndex = Math.floor(totalWords * ratio);

    let currentWordIndex = 0;
    for (const n of textNodes) {
      const text = n.nodeValue || "";
      const wordsArray = text.split(/(\s+)/);
      let modified = false;

      for (let i = 0; i < wordsArray.length; i++) {
        if (wordsArray[i].trim().length > 0) {
          if (currentWordIndex === targetIndex) {
            wordsArray[i] = `<span class="bg-brand-500/40 text-brand-700 dark:text-brand-300 font-medium rounded px-[2px] transition-all duration-200" id="tts-highlighted-word">${wordsArray[i]}</span>`;
            modified = true;
          }
          currentWordIndex++;
        }
      }

      if (modified) {
        const spanWrapper = document.createElement("span");
        spanWrapper.innerHTML = wordsArray.join("");
        n.parentNode?.replaceChild(spanWrapper, n);
        break; // Only highlight one word
      }
    }

    // Auto-scroll logic inside the container
    const highlightEl = visibleRef.current.querySelector("#tts-highlighted-word");
    if (highlightEl && visibleRef.current) {
      const containerRect = visibleRef.current.getBoundingClientRect();
      const elRect = highlightEl.getBoundingClientRect();

      // Check if element is out of the visible bounds of the container
      if (
        elRect.top < containerRect.top ||
        elRect.bottom > containerRect.bottom
      ) {
         // Smooth scroll the container
         const container = visibleRef.current;
         container.scrollTo({
           top: container.scrollTop + (elRect.top - containerRect.top) - containerRect.height / 2,
           behavior: "smooth"
         });
      }
    }
  }, [rendered, progress]);

  return (
    <div className="relative">
      {/* Hidden React Markdown renderer */}
      <div 
        ref={hiddenRef} 
        className="absolute opacity-0 pointer-events-none -z-10 h-0 w-0 overflow-hidden" 
        aria-hidden="true"
      >
        <Markdown content={content} />
      </div>

      {/* Visible manually managed DOM */}
      <div
        ref={visibleRef}
        className="w-full max-h-[3rem] overflow-hidden pr-2 text-sm leading-6 text-[var(--text-primary)] [&_blockquote]:my-0 [&_code]:text-[0.85em] [&_h1]:my-0 [&_h2]:my-0 [&_h3]:my-0 [&_li]:mb-0 [&_ol]:my-0 [&_p]:mb-0 [&_pre]:my-0 [&_ul]:my-0"
      />
    </div>
  );
}
