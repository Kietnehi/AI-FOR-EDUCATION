import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isSpeechSynthesisSupported,
  markdownToPlainText,
  speakText,
  stopSpeaking,
} from "@/lib/tts";

describe("markdownToPlainText", () => {
  it("loại bỏ markdown và giữ lại nội dung đọc được", () => {
    const markdown = `# Tiêu đề

- Mục 1
- Mục 2

Đây là **đoạn văn** có [liên kết](https://example.com) và \`code\`.`;

    expect(markdownToPlainText(markdown)).toBe(
      "Tiêu đề Mục 1 Mục 2 Đây là đoạn văn có liên kết và code."
    );
  });

  it("loại bỏ code block và comment HTML", () => {
    const markdown = `<!-- hidden -->\n\n\
\
\
\`\`\`ts
const secret = true;
\`\`\`

Nội dung còn lại`;

    expect(markdownToPlainText(markdown)).toBe("Nội dung còn lại");
  });
});

describe("speech synthesis helpers", () => {
  const originalSpeechSynthesis = window.speechSynthesis;
  const OriginalUtterance = globalThis.SpeechSynthesisUtterance;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: originalSpeechSynthesis,
    });

    globalThis.SpeechSynthesisUtterance = OriginalUtterance;
  });

  it("phát hiện môi trường có hỗ trợ speech synthesis", () => {
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn().mockReturnValue([]) },
    });

    class MockUtterance {
      constructor(public text: string) {}
    }

    globalThis.SpeechSynthesisUtterance = MockUtterance as typeof SpeechSynthesisUtterance;

    expect(isSpeechSynthesisSupported()).toBe(true);
  });

  it("speakText dùng giọng tiếng Việt ưu tiên nếu có", () => {
    const cancel = vi.fn();
    const speak = vi.fn();
    const getVoices = vi.fn().mockReturnValue([
      { lang: "en-US", name: "English" },
      { lang: "vi-VN", name: "Vietnamese" },
    ]);

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel, speak, getVoices },
    });

    class MockUtterance {
      text: string;
      lang = "";
      voice?: { lang: string; name: string };
      onend?: () => void;
      onerror?: () => void;

      constructor(text: string) {
        this.text = text;
      }
    }

    globalThis.SpeechSynthesisUtterance = MockUtterance as typeof SpeechSynthesisUtterance;

    const onEnd = vi.fn();
    const result = speakText("**Xin chào** bạn", { onEnd });

    expect(result).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);

    const utterance = speak.mock.calls[0][0] as MockUtterance;
    expect(utterance.text).toBe("Xin chào bạn");
    expect(utterance.lang).toBe("vi-VN");
    expect(utterance.voice?.lang).toBe("vi-VN");

    utterance.onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("stopSpeaking gọi cancel khi trình duyệt hỗ trợ", () => {
    const cancel = vi.fn();

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel, speak: vi.fn(), getVoices: vi.fn().mockReturnValue([]) },
    });

    stopSpeaking();

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("không đọc khi nội dung rỗng sau khi làm sạch", () => {
    const cancel = vi.fn();
    const speak = vi.fn();

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel, speak, getVoices: vi.fn().mockReturnValue([]) },
    });

    class MockUtterance {
      constructor(public text: string) {}
    }

    globalThis.SpeechSynthesisUtterance = MockUtterance as typeof SpeechSynthesisUtterance;

    const result = speakText("```ts\nconst x = 1\n```", {});

    expect(result).toBe(false);
    expect(speak).not.toHaveBeenCalled();
  });
});
