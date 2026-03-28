import { describe, expect, it } from "vitest";

import { diacritizeText } from "@/lib/diacritize";

describe("diacritizeText", () => {
  it("thêm dấu cho các từ tiếng Việt phổ biến", () => {
    expect(diacritizeText("xin chao ban")).toBe("xin chào bạn");
  });

  it("giữ nguyên câu đã có dấu", () => {
    expect(diacritizeText("xin chào bạn")).toBe("xin chào bạn");
  });

  it("giữ nguyên chữ hoa đầu câu khi ánh xạ", () => {
    expect(diacritizeText("Xin chao ban")).toBe("Xin chào bạn");
  });
});
