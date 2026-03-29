"use client";

import React, { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/ui/markdown";

interface TtsMarkdownProps {
  content: string;
  progress: number;
}

export function TtsMarkdown({ content, progress }: TtsMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markdownRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const [totalWords, setTotalWords] = useState(0);
  const wordWeightsRef = useRef<number[]>([]);
  const totalWeightRef = useRef(0);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const updateDisplay = () => {
      if (!markdownRef.current || !displayRef.current) return;
      
      const template = markdownRef.current.cloneNode(true) as HTMLDivElement;
      
      // Remove any interactive button like copy button
      const buttons = template.querySelectorAll('button');
      buttons.forEach(btn => btn.remove());
      
      const walker = document.createTreeWalker(template, NodeFilter.SHOW_TEXT, null);
      const textNodes: Node[] = [];
      let node;
      while ((node = walker.nextNode())) {
         if (node.nodeValue && node.nodeValue.trim() !== '') {
           let parent = node.parentElement;
           let inPre = false;
           while (parent && parent !== template) {
             if (parent.tagName.toLowerCase() === 'pre' || parent.tagName.toLowerCase() === 'code') {
               inPre = true;
               break;
             }
             parent = parent.parentElement;
           }
           if (!inPre) {
             textNodes.push(node);
           }
         }
      }

      let currentWordIndex = 0;
      const wordWeights: number[] = [];
      textNodes.forEach(textNode => {
        const text = textNode.nodeValue || "";
        const parts = text.split(/(\s+)/);
        const fragment = document.createDocumentFragment();
        
        parts.forEach(part => {
           if (part.length === 0) return;
           if (part.trim().length === 0) {
              fragment.appendChild(document.createTextNode(part));
            } else {
               const span = document.createElement("span");
               span.textContent = part;
               span.dataset.ttsWordIndex = currentWordIndex.toString();
               span.className = "transition-all duration-200 rounded px-[2px] border border-transparent";
               fragment.appendChild(span);
               const cleanPart = part.replace(/[“”"(){}\[\]]/g, "");
               let weight = Math.max(1, cleanPart.length / 4);
               if (/[,:;]$/.test(cleanPart)) weight += 1.25;
               if (/[.!?…]$/.test(cleanPart)) weight += 3;
               wordWeights.push(weight);
               currentWordIndex++;
            }
         });
        
        if (textNode.parentNode) {
            textNode.parentNode.replaceChild(fragment, textNode);
        }
      });

      displayRef.current.innerHTML = template.innerHTML;
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
      wordWeightsRef.current = wordWeights;
      totalWeightRef.current = wordWeights.reduce((sum, weight) => sum + weight, 0);
      setTotalWords(currentWordIndex);
    };

    // Delay slightly to let markdown subcomponents (like Prism) mount completely
    timeoutId = setTimeout(updateDisplay, 50);

    let observer: MutationObserver | null = null;
    if (markdownRef.current) {
      observer = new MutationObserver(() => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(updateDisplay, 100);
      });
      observer.observe(markdownRef.current, { childList: true, subtree: true, characterData: true });
    }

    return () => {
      clearTimeout(timeoutId);
      if (observer) observer.disconnect();
    };
  }, [content]);

  useEffect(() => {
    if (!displayRef.current || totalWords === 0) return;
    
    const allHighlights = displayRef.current.querySelectorAll('.tts-highlight');
    allHighlights.forEach(el => {
       el.classList.remove('tts-highlight', 'bg-brand-500/30', 'text-brand-900', 'dark:text-brand-300', 'font-medium', 'border-brand-500/20');
       el.classList.add('border-transparent');
    });

    const totalWeight = totalWeightRef.current;
    let targetIndex = Math.min(totalWords - 1, Math.floor(totalWords * progress));
    if (totalWeight > 0) {
      const targetWeight = totalWeight * Math.min(Math.max(progress, 0), 1);
      let cumulativeWeight = 0;
      for (let index = 0; index < wordWeightsRef.current.length; index += 1) {
        cumulativeWeight += wordWeightsRef.current[index] || 0;
        if (cumulativeWeight >= targetWeight) {
          targetIndex = index;
          break;
        }
      }
    }
    if (targetIndex >= 0) {
       const current = displayRef.current.querySelector(`[data-tts-word-index="${targetIndex}"]`);
        if (current) {
           current.classList.add('tts-highlight', 'bg-brand-500/30', 'text-brand-900', 'dark:text-brand-300', 'font-medium', 'border-brand-500/20');
           current.classList.remove('border-transparent');
           if (containerRef.current) {
             const containerHeight = containerRef.current.clientHeight;
             const displayHeight = displayRef.current.scrollHeight;
             const targetElement = current as HTMLElement;
             const desiredOffset = targetElement.offsetTop + targetElement.offsetHeight / 2 - containerHeight / 2;
             const maxOffset = Math.max(0, displayHeight - containerHeight);
             const nextOffset = Math.min(Math.max(desiredOffset, 0), maxOffset);
              containerRef.current.scrollTop = nextOffset;
            }
          }
     } else {
       if (containerRef.current) {
         containerRef.current.scrollTop = 0;
       }
       }
  }, [progress, totalWords]);

  return (
    <div 
      className="w-full relative overflow-hidden rounded-md"
      style={{
        minHeight: "3rem"
      }}
    >
      <div 
         ref={markdownRef} 
         className="absolute opacity-0 pointer-events-none w-full h-[1px] overflow-hidden" 
         aria-hidden="true"
      >
         <Markdown content={content} />
      </div>

        <div 
          ref={containerRef}
          className="w-full overflow-y-auto text-[13px] leading-relaxed custom-scrollbar"
          style={{
            height: "8.8em",
          }}
        >
        <div
          ref={displayRef}
          className="tts-display-container markdown-body"
        />
       </div>
    </div>
  );
}
