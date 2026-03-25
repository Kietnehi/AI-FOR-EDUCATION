type SpeakOptions = {
  lang?: string;
  onEnd?: () => void;
  onError?: () => void;
};

function toSpeechText(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[>#*_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
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