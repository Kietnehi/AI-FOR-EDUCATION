import {
  ChatMessage,
  ChatSession,
  GeneratedContent,
  Material,
  MascotChatResponse,
  NotebookLMArtifactConfirmationResult,
  NotebookLMMediaResult,
  NotebookLMResponse,
  NotebookLMSavedResult,
  SttModel,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

type ApiFetchOptions = RequestInit & {
  cacheTtlMs?: number;
  skipCache?: boolean;
};

type CacheEntry = {
  data: unknown;
  expiresAt: number;
};

const DEFAULT_GET_CACHE_TTL_MS = 15000;
const responseCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<unknown>>();

function getCacheKey(path: string): string {
  return path;
}

function readCache<T>(key: string): T | null {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return cached.data as T;
}

function writeCache(key: string, data: unknown, ttlMs: number): void {
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function invalidateCache(...prefixes: string[]): void {
  if (!prefixes.length) {
    responseCache.clear();
    inflightRequests.clear();
    return;
  }

  for (const key of Array.from(responseCache.keys())) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      responseCache.delete(key);
    }
  }
}

function primeCache(path: string, data: unknown, ttlMs: number = DEFAULT_GET_CACHE_TTL_MS): void {
  writeCache(getCacheKey(path), data, ttlMs);
}

async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const cacheKey = getCacheKey(path);
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_GET_CACHE_TTL_MS;

  if (isGet && !options?.skipCache) {
    const cached = readCache<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const inflight = inflightRequests.get(cacheKey);
    if (inflight) {
      return inflight as Promise<T>;
    }
  }

  const requestPromise = (async () => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      cache: isGet ? "default" : "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed: ${response.status}`);
    }

    const data = await response.json() as T;
    if (isGet && !options?.skipCache) {
      writeCache(cacheKey, data, cacheTtlMs);
    }
    return data;
  })();

  if (isGet && !options?.skipCache) {
    inflightRequests.set(cacheKey, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (isGet) {
      inflightRequests.delete(cacheKey);
    }
  }
}

export async function listMaterials(): Promise<{ items: Material[]; total: number }> {
  return apiFetch<{ items: Material[]; total: number }>("/materials");
}

export async function deleteMaterial(id: string): Promise<void> {
  const result = await apiFetch<void>(`/materials/${id}`, { method: "DELETE" });
  invalidateCache("/materials", `/materials/${id}`);
  return result;
}

export async function getMaterial(id: string): Promise<Material> {
  return apiFetch<Material>(`/materials/${id}`);
}

export async function processMaterial(id: string): Promise<{ message: string }> {
  const result = await apiFetch<{ message: string }>(`/materials/${id}/process`, {
    method: "POST",
    body: JSON.stringify({ force_reprocess: false }),
  });
  invalidateCache("/materials", `/materials/${id}`);
  return result;
}

export async function generateSlides(
  id: string,
  options?: { max_slides?: number; tone?: string; skip_refine?: boolean }
): Promise<GeneratedContent> {
  const data = await apiFetch<GeneratedContent>(`/materials/${id}/generate/slides`, {
    method: "POST",
    body: JSON.stringify({
      tone: options?.tone || "teacher",
      max_slides: options?.max_slides || 10,
      skip_refine: options?.skip_refine || false,
    }),
  });
  primeCache(`/generated-contents/${data.id}`, data);
  return data;
}

export async function generatePodcast(id: string): Promise<GeneratedContent> {
  const data = await apiFetch<GeneratedContent>(`/materials/${id}/generate/podcast`, {
    method: "POST",
    body: JSON.stringify({ style: "lecturer", target_duration_minutes: 8 }),
  });
  primeCache(`/generated-contents/${data.id}`, data);
  return data;
}

export async function generateMinigame(id: string, gameType: "quiz_mixed" | "flashcard" | "shooting_quiz" = "quiz_mixed"): Promise<GeneratedContent> {
  return apiFetch<GeneratedContent>(`/materials/${id}/generate/minigame`, {
    method: "POST",
    body: JSON.stringify({ game_type: gameType }),
    cacheTtlMs: gameType === "shooting_quiz" ? 180000 : 60000,
  });
}

export async function getGeneratedContent(id: string): Promise<GeneratedContent> {
  return apiFetch<GeneratedContent>(`/generated-contents/${id}`);
}

export async function generateNotebookLMMedia(prompt: string, confirm: boolean = false): Promise<NotebookLMResponse> {
  return apiFetch<NotebookLMResponse>("/notebooklm/generate-media", {
    method: "POST",
    body: JSON.stringify({ prompt, confirm }),
  });
}

export async function generateNotebookLMMediaFromMaterial(
  materialId: string,
  guidance?: string,
  confirm: boolean = false
): Promise<NotebookLMResponse> {
  return apiFetch<NotebookLMResponse>(`/materials/${materialId}/generate/notebooklm-media`, {
    method: "POST",
    body: JSON.stringify({ guidance: guidance || null, confirm }),
  });
}

export async function confirmNotebookLMDownload(sessionId: string): Promise<NotebookLMSavedResult> {
  return apiFetch<NotebookLMSavedResult>(`/notebooklm/sessions/${sessionId}/confirm`, {
    method: "POST",
  });
}

export async function confirmNotebookLMArtifactGeneration(
  sessionId: string
): Promise<NotebookLMMediaResult | NotebookLMArtifactConfirmationResult> {
  return apiFetch<NotebookLMMediaResult | NotebookLMArtifactConfirmationResult>(
    `/notebooklm/sessions/${sessionId}/confirm-artifacts`,
    {
      method: "POST",
    }
  );
}

export async function cancelNotebookLMSession(sessionId: string): Promise<{ session_id: string; status: string }> {
  return apiFetch<{ session_id: string; status: string }>(`/notebooklm/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function createChatSession(materialId: string): Promise<ChatSession> {
  const session = await apiFetch<ChatSession>(`/chat/${materialId}/session`, {
    method: "POST",
    body: JSON.stringify({ user_id: "demo-user" }),
  });
  primeCache(`/chat/sessions/${session.id}`, { session, messages: [] });
  return session;
}

export async function getChatSession(sessionId: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
  return apiFetch<{ session: ChatSession; messages: ChatMessage[] }>(`/chat/sessions/${sessionId}`);
}

export async function sendChatMessage(sessionId: string, message: string, images?: string[]): Promise<ChatMessage> {
  const chatMessage = await apiFetch<ChatMessage>(`/chat/sessions/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify({ message, images: images || [] }),
  });
  invalidateCache(`/chat/sessions/${sessionId}`);
  return chatMessage;
}

export async function sendMascotChatMessage(
  message: string,
  sessionId?: string,
  images?: string[]
): Promise<MascotChatResponse> {
  return apiFetch<MascotChatResponse>("/chat/mascot/message", {
    method: "POST",
    body: JSON.stringify({ message, session_id: sessionId || null, images: images || [] }),
  });
}

export async function transcribeChatAudio(
  audioBlob: Blob,
  sttModel: SttModel
): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("stt_model", sttModel);

  const response = await fetch(`${API_BASE}/chat/transcribe`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<{ text: string }>;
}

export async function synthesizeChatSpeech(text: string, lang: string = "vi"): Promise<Blob> {
  const response = await fetch(`${API_BASE}/chat/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, lang }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return response.blob();
}

export async function submitGameAttempt(
  generatedContentId: string,
  answers: Array<{ id?: string; node_id?: string; answer: string }>
): Promise<any> {
  return apiFetch<any>(`/games/${generatedContentId}/submit`, {
    method: "POST",
    body: JSON.stringify({ user_id: "demo-user", answers }),
  });
}

export function apiDownloadUrl(fileUrl: string): string {
  if (!fileUrl) return "#";
  return `${process.env.NEXT_PUBLIC_API_HOST || "http://localhost:8000"}${fileUrl}`;
}
