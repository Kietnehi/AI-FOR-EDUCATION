import { describe, expect, it } from "vitest";

import { apiDownloadUrl } from "@/lib/api";

describe("apiDownloadUrl", () => {
  it("trả về ký tự fallback khi file rỗng", () => {
    expect(apiDownloadUrl("")).toBe("#");
  });

  it("ghép host mặc định với đường dẫn file", () => {
    expect(apiDownloadUrl("/files/demo.pdf")).toBe("http://localhost:8000/files/demo.pdf");
  });
});
