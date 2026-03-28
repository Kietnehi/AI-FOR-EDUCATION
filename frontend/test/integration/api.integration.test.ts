import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
}

describe("API integration flow", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("dùng lại cache cho request GET lặp lại", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [],
        total: 0,
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const { listMaterials } = await import("@/lib/api");

    await listMaterials();
    await listMaterials();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("làm mới cache sau khi xử lý học liệu", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "m1",
              user_id: "u1",
              title: "Bài giảng 1",
              source_type: "upload",
              tags: [],
              processing_status: "uploaded",
              created_at: "2026-03-28T00:00:00.000Z",
              updated_at: "2026-03-28T00:00:00.000Z",
            },
          ],
          total: 1,
        })
      )
      .mockResolvedValueOnce(jsonResponse({ message: "ok" }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "m1",
              user_id: "u1",
              title: "Bài giảng 1",
              source_type: "upload",
              tags: [],
              processing_status: "processed",
              created_at: "2026-03-28T00:00:00.000Z",
              updated_at: "2026-03-28T00:05:00.000Z",
            },
          ],
          total: 1,
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const { listMaterials, processMaterial } = await import("@/lib/api");

    await listMaterials();
    await listMaterials();
    await processMaterial("m1");
    const refreshed = await listMaterials();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(refreshed.items[0]?.processing_status).toBe("processed");
  });

  it("prime cache generated content sau khi tạo slide", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: "g1",
        material_id: "m1",
        content_type: "slides",
        version: 1,
        outline: ["Mở đầu"],
        json_content: {},
        generation_status: "generated",
        created_at: "2026-03-28T00:00:00.000Z",
        updated_at: "2026-03-28T00:00:00.000Z",
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const { generateSlides, getGeneratedContent } = await import("@/lib/api");

    await generateSlides("m1");
    const generated = await getGeneratedContent("g1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generated.id).toBe("g1");
  });
});
