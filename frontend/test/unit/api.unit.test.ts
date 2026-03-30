import { describe, expect, it } from "vitest";

import { apiDownloadUrl, apiPreviewUrl } from "@/lib/api";

describe("apiDownloadUrl", () => {
  it("trả về ký tự fallback khi file rỗng", () => {
    expect(apiDownloadUrl("")).toBe("#");
  });

  it("ghép host mặc định với đường dẫn file local", () => {
    expect(apiDownloadUrl("/files/demo.pdf")).toBe("http://localhost:8000/files/demo.pdf");
  });

  it("proxy URL MinIO qua backend khi tải file", () => {
    expect(apiDownloadUrl("http://minio:9000/bucket/generated/podcasts/demo.mp3")).toBe(
      "http://localhost:8000/api/files/http%3A%2F%2Fminio%3A9000%2Fbucket%2Fgenerated%2Fpodcasts%2Fdemo.mp3/download",
    );
  });
});

describe("apiPreviewUrl", () => {
  it("đổi local download route sang preview route", () => {
    expect(apiPreviewUrl("/api/files/extracted/image.png/download")).toBe(
      "http://localhost:8000/api/files/extracted/image.png/preview",
    );
  });

  it("proxy URL MinIO qua backend khi preview file", () => {
    expect(apiPreviewUrl("http://minio:9000/bucket/generated/slides/image.png")).toBe(
      "http://localhost:8000/api/files/http%3A%2F%2Fminio%3A9000%2Fbucket%2Fgenerated%2Fslides%2Fimage.png/preview",
    );
  });
});
