type SpeakOptions = {
  lang?: string;
  onEnd?: () => void;
  onError?: () => void;
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