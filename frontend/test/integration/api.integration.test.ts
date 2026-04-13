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

  it("đọc và cập nhật preferences cá nhân hóa", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          user_id: "u1",
          theme: "system",
          mascot_enabled: true,
          chat_model_id: "openai/gpt-4o-mini",
          chat_model_name: "GPT-4o Mini",
          chat_model_supports_reasoning: false,
          chat_use_gemini_rotation: true,
          chat_custom_models: [],
          preferred_language: "vi",
          learning_pace: "moderate",
          study_goal: null,
          created_at: "2026-03-28T00:00:00.000Z",
          updated_at: "2026-03-28T00:00:00.000Z",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          user_id: "u1",
          theme: "system",
          mascot_enabled: true,
          chat_model_id: "openai/gpt-4o-mini",
          chat_model_name: "GPT-4o Mini",
          chat_model_supports_reasoning: false,
          chat_use_gemini_rotation: true,
          chat_custom_models: [],
          preferred_language: "en",
          learning_pace: "intensive",
          study_goal: "Pass exam",
          created_at: "2026-03-28T00:00:00.000Z",
          updated_at: "2026-03-28T00:05:00.000Z",
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const { getUserPreferences, updateUserPreferences } = await import("@/lib/api");

    const initial = await getUserPreferences();
    const updated = await updateUserPreferences({
      preferred_language: "en",
      learning_pace: "intensive",
      study_goal: "Pass exam",
    });

    expect(initial.preferred_language).toBe("vi");
    expect(updated.learning_pace).toBe("intensive");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCall = fetchMock.mock.calls[1];
    expect(String(secondCall?.[0])).toContain("/personalization/preferences");
    expect((secondCall?.[1] as RequestInit)?.method).toBe("PUT");
  });

  it("lấy dashboard personalization với study rhythm mở rộng", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        generated_counts: { slides: 2, podcast: 1, minigame: 3 },
        continue_learning: [],
        next_actions: ["Tiếp tục học"],
        feature_affinity: [
          { feature: "chat", score: 100, reason: "Bạn dùng chat thường xuyên." },
        ],
        study_rhythm: {
          active_days_7d: 3,
          events_7d: 12,
          last_active_at: "2026-03-28T00:00:00.000Z",
          retention_status: "medium",
          days_since_last_active: 1,
          top_feature: "chat",
        },
        summary: {
          materials_total: 4,
          generated_total: 6,
          chat_sessions_total: 8,
          game_attempts_total: 5,
          average_game_accuracy: 72.5,
        },
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const { getDashboardPersonalization } = await import("@/lib/api");
    const payload = await getDashboardPersonalization();

    expect(payload.study_rhythm.top_feature).toBe("chat");
    expect(payload.feature_affinity[0]?.feature).toBe("chat");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/personalization/dashboard");
  });
});
