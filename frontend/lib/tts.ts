type SpeakOptions = {
  lang?: string;
  onEnd?: () => void;
  onError?: () => void;
};

export type TtsTextSegment = {
  text: string;
};

/**
 * Convert markdown text to plain text suitable for text-to-speech
 * Extracts the rendered content that users would see
 */
function convertMarkdownToPlainText(markdown: string): string {
  let text = markdown;

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, " ");

  // Remove code blocks with language (e.g., ```python ... ```)
  text = text.replace(/```[\s\S]*?```/g, " ");

  // Remove inline code
  text = text.replace(/`([^`]+)`/g, "$1");

  // Remove links but keep the link text: [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // Remove reference-style links [text][ref]
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");

  // Remove headings (#, ##, etc.) but keep their content
  text = text.replace(/^#+\s+(.+)$/gm, "$1");

  // Remove bold (**text** or __text__)
  text = text.replace(/\*\*([^\*]+)\*\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");

  // Remove italic (*text* or _text_)
  text = text.replace(/\*([^\*]+)\*/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");

  // Remove strikethrough (~~text~~)
  text = text.replace(/~~([^~]+)~~/g, "$1");

  // Remove blockquotes (> text)
  text = text.replace(/^\s*>\s+(.+)$/gm, "$1");

  // Remove unordered list markers (-, *, +)
  text = text.replace(/^\s*[-*+]\s+(.+)$/gm, "$1");

  // Remove ordered list markers (1., 2., etc.)
  text = text.replace(/^\s*\d+\.\s+(.+)$/gm, "$1");

  // Remove horizontal rules (---, ***, ___)
  text = text.replace(/^\s*([-*_])\1{2,}\s*$/gm, "");

  // Remove table formatting
  text = text.replace(/\|[\s\S]*?\|/g, " ");

  // Remove extra whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

function toSpeechText(input: string): string {
  return convertMarkdownToPlainText(input);
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function markdownToPlainText(markdown: string): string {
  return convertMarkdownToPlainText(markdown);
}

export function splitTextForTts(markdown: string, maxSegmentLength: number = 260): TtsTextSegment[] {
  const plainText = convertMarkdownToPlainText(markdown);
  if (!plainText) {
    return [];
  }

  const rawSegments = plainText
    .split(/(?<=[.!?…])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const segments: TtsTextSegment[] = [];
  for (const rawSegment of rawSegments) {
    if (rawSegment.length <= maxSegmentLength) {
      segments.push({ text: rawSegment });
      continue;
    }

    const clauses = rawSegment
      .split(/(?<=[,;:])\s+/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    let buffer = "";
    for (const clause of clauses) {
      const candidate = buffer ? `${buffer} ${clause}` : clause;
      if (candidate.length <= maxSegmentLength) {
        buffer = candidate;
        continue;
      }

      if (buffer) {
        segments.push({ text: buffer });
      }

      if (clause.length <= maxSegmentLength) {
        buffer = clause;
        continue;
      }

      const words = clause.split(/\s+/).filter(Boolean);
      let wordBuffer = "";
      for (const word of words) {
        const wordCandidate = wordBuffer ? `${wordBuffer} ${word}` : word;
        if (wordCandidate.length <= maxSegmentLength) {
          wordBuffer = wordCandidate;
          continue;
        }

        if (wordBuffer) {
          segments.push({ text: wordBuffer });
        }
        wordBuffer = word;
      }

      buffer = wordBuffer;
    }

    if (buffer) {
      segments.push({ text: buffer });
    }
  }

  return segments;
}

export function getSegmentBaseTime(
  segments: Array<{ duration: number }>,
  segmentIndex: number,
): number {
  return segments.slice(0, segmentIndex).reduce((sum, segment) => sum + segment.duration, 0);
}

export async function getAudioDurationFromUrl(audioUrl: string): Promise<number> {
  if (typeof window === "undefined") {
    return 0;
  }

  return new Promise((resolve) => {
    const audio = new Audio();

    const cleanup = () => {
      audio.removeAttribute("src");
      audio.load();
    };

    audio.preload = "metadata";
    audio.src = audioUrl;
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      cleanup();
      resolve(duration);
    };
    audio.onerror = () => {
      cleanup();
      resolve(0);
    };
  });
}

export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) {
    return;
  }
  window.speechSynthesis.cancel();
}

export function speakText(text: string, options: SpeakOptions = {}): boolean {
  if (!isSpeechSynthesisSupported()) {
    return false;
  }

  const cleanedText = toSpeechText(text);
  if (!cleanedText) {
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(cleanedText);
  utterance.lang = options.lang || "vi-VN";

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith("vi"));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
    utterance.lang = preferredVoice.lang;
  }

  utterance.onend = () => {
    options.onEnd?.();
  };

  utterance.onerror = () => {
    options.onError?.();
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}
