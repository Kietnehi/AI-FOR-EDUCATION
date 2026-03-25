// Lightweight, best-effort Vietnamese diacritization for TTS.
// This improves pronunciation for short non-diacritic snippets in UI/chat.

const COMMON_MAP: Record<string, string> = {
  dung: "dừng",
  doc: "đọc",
  noi: "nội",
  nghe: "nghe",
  xin: "xin",
  chao: "chào",
  minh: "mình",
  ban: "bạn",
  la: "là",
  can: "cần",
  ho: "hỗ",
  tro: "trợ",
  gui: "gửi",
  cau: "câu",
  hoi: "hỏi",
  tra: "trả",
  loi: "lời",
  ve: "về",
};

function hasVietnameseDiacritics(value: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu.test(value);
}

export function diacritizeText(input: string): string {
  if (!input || hasVietnameseDiacritics(input)) {
    return input;
  }

  const tokens = input.split(/(\s+|[^\p{L}\p{N}]+)/u);

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token || /\s+/.test(token) || /[^\p{L}\p{N}]+/u.test(token)) {
      continue;
    }

    const lower = token.toLowerCase();
    const mapped = COMMON_MAP[lower];
    if (!mapped) {
      continue;
    }

    tokens[i] = /^[A-Z]/.test(token) ? mapped[0].toUpperCase() + mapped.slice(1) : mapped;
  }

  return tokens.join("");
}
