import {
  ChatMessage,
  ChatSession,
  DeleteSessionsResult,
  MinigamePersonalization,
  MaterialDetailRealtimeSnapshot,
  MaterialsRealtimeSnapshot,
  RemediationQuickStart,
  GeneratedContent,
  Material,
  MascotChatMessage,
  MascotChatResponse,
  MascotChatSession,
  NotebookLMArtifactConfirmationResult,
  NotebookLMMediaResult,
  NotebookLMResponse,
  NotebookLMSavedResult,
  SttModel,
  DuckDuckGoSearchItem,
  DuckDuckGoSearchType,
  DashboardPersonalization,
  UserPreferences,
  UserPreferencesUpdate,
} from "@/types";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface CooperationContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  captchaToken: string;
}

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
const cacheVersions = new Map<string, number>();

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

function getCacheVersion(key: string): number {
  return cacheVersions.get(key) ?? 0;
}

function bumpCacheVersion(key: string): void {
  cacheVersions.set(key, getCacheVersion(key) + 1);
}

function writeCache(key: string, data: unknown, ttlMs: number): void {
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function invalidateCache(...prefixes: string[]): void {
  const trackedKeys = new Set<string>([
    ...responseCache.keys(),
    ...inflightRequests.keys(),
  ]);

  if (!prefixes.length) {
    trackedKeys.forEach((key) => bumpCacheVersion(key));
    responseCache.clear();
    inflightRequests.clear();
    return;
  }

  for (const key of trackedKeys) {
    if (!prefixes.some((prefix) => key.startsWith(prefix))) {
      continue;
    }

    bumpCacheVersion(key);
    responseCache.delete(key);
    inflightRequests.delete(key);
  }

}

export function clearApiCache(): void {
  invalidateCache();
}

function primeCache(path: string, data: unknown, ttlMs: number = DEFAULT_GET_CACHE_TTL_MS): void {
  writeCache(getCacheKey(path), data, ttlMs);
}

function openEventStream(path: string): EventSource {
  return new EventSource(`${API_BASE}${path}`, { withCredentials: true });
}

async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const cacheKey = getCacheKey(path);
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_GET_CACHE_TTL_MS;
  const requestVersion = getCacheVersion(cacheKey);

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
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      cache: isGet ? "default" : "no-store",
    });

    if (!response.ok) {
      const text = await response.text();

      if (response.status === 401 && !path.startsWith("/auth/")) {
        invalidateCache();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("auth-required"));
        }
        throw new Error(
          JSON.stringify({
            code: "AUTH_REQUIRED",
            detail: "Vui lòng đăng nhập trước khi thực hiện chức năng này.",
          })
        );
      }

      throw new Error(text || `Request failed: ${response.status}`);
    }

    const data = await response.json() as T;
    if (isGet && !options?.skipCache && getCacheVersion(cacheKey) === requestVersion) {
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

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function loginWithGoogle(
  idToken: string,
  captchaToken: string
): Promise<{ user: AuthUser; message: string }> {
  return apiFetch<{ user: AuthUser; message: string }>("/auth/google/login", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken, captcha_token: captchaToken }),
  });
}

export async function registerWithGoogle(
  idToken: string,
  captchaToken: string
): Promise<{ user: AuthUser; message: string }> {
  return apiFetch<{ user: AuthUser; message: string }>("/auth/google/register", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken, captcha_token: captchaToken }),
  });
}

export async function logout(): Promise<{ message: string }> {
  const result = await apiFetch<{ message: string }>("/auth/logout", {
    method: "POST",
  });
  invalidateCache();
  return result;
}

export async function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/me");
}

export async function getUserPreferences(): Promise<UserPreferences> {
  return apiFetch<UserPreferences>("/personalization/preferences", { skipCache: true });
}

export async function updateUserPreferences(
  payload: UserPreferencesUpdate
): Promise<UserPreferences> {
  const result = await apiFetch<UserPreferences>("/personalization/preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  invalidateCache("/personalization/preferences", "/personalization/dashboard");
  return result;
}

export async function getDashboardPersonalization(): Promise<DashboardPersonalization> {
  return apiFetch<DashboardPersonalization>("/personalization/dashboard", {
    skipCache: true,
  });
}

export async function submitCooperationContact(
  payload: CooperationContactPayload
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/contact/cooperation", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      subject: payload.subject,
      message: payload.message,
      captcha_token: payload.captchaToken,
    }),
  });
}

export async function listMaterials(): Promise<{ items: Material[]; total: number }> {
  return apiFetch<{ items: Material[]; total: number }>("/materials");
}

export function subscribeToMaterialsRealtime(handlers: {
  onSnapshot: (snapshot: MaterialsRealtimeSnapshot) => void;
  onError?: () => void;
}): () => void {
  const eventSource = openEventStream("/realtime/materials/stream");
  const handleSnapshot = (event: MessageEvent<string>) => {
    const snapshot = JSON.parse(event.data) as MaterialsRealtimeSnapshot;
    primeCache("/materials", { items: snapshot.items, total: snapshot.total });
    for (const item of snapshot.items) {
      primeCache(`/materials/${item.id}`, item);
    }
    handlers.onSnapshot(snapshot);
  };

  eventSource.addEventListener("snapshot", handleSnapshot as EventListener);
  eventSource.onerror = () => handlers.onError?.();

  return () => {
    eventSource.removeEventListener("snapshot", handleSnapshot as EventListener);
    eventSource.close();
  };
}

export async function deleteMaterial(id: string): Promise<void> {
  const result = await apiFetch<void>(`/materials/${id}`, { method: "DELETE" });
  invalidateCache("/materials", `/materials/${id}`);
  return result;
}

export async function getMaterial(id: string): Promise<Material> {
  return apiFetch<Material>(`/materials/${id}`);
}

export function subscribeToMaterialRealtime(
  materialId: string,
  handlers: {
    onSnapshot: (snapshot: MaterialDetailRealtimeSnapshot) => void;
    onError?: () => void;
  }
): () => void {
  const eventSource = openEventStream(
    `/realtime/materials/stream?material_id=${encodeURIComponent(materialId)}`
  );
  const handleSnapshot = (event: MessageEvent<string>) => {
    const snapshot = JSON.parse(event.data) as MaterialDetailRealtimeSnapshot;
    invalidateCache("/materials");
    if (snapshot.deleted || !snapshot.material) {
      invalidateCache(`/materials/${materialId}`, `/materials/${materialId}/generated-contents`);
      handlers.onSnapshot(snapshot);
      return;
    }

    primeCache(`/materials/${materialId}`, snapshot.material);
    primeCache(`/materials/${materialId}/generated-contents`, snapshot.generated_contents);
    handlers.onSnapshot(snapshot);
  };

  eventSource.addEventListener("snapshot", handleSnapshot as EventListener);
  eventSource.onerror = () => handlers.onError?.();

  return () => {
    eventSource.removeEventListener("snapshot", handleSnapshot as EventListener);
    eventSource.close();
  };
}

export async function updateMaterial(
  id: string,
  payload: {
    title?: string;
    description?: string;
    subject?: string;
    education_level?: string;
    tags?: string[];
  }
): Promise<Material> {
  const result = await apiFetch<Material>(`/materials/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  invalidateCache("/materials", `/materials/${id}`);
  return result;
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
  options?: { max_slides?: number; tone?: string; skip_refine?: boolean; force_regenerate?: boolean }
): Promise<GeneratedContent> {
  const data = await apiFetch<GeneratedContent>(`/materials/${id}/generate/slides`, {
    method: "POST",
    body: JSON.stringify({
      tone: options?.tone || "teacher",
      max_slides: options?.max_slides || 10,
      skip_refine: options?.skip_refine || false,
      force_regenerate: options?.force_regenerate || false,
    }),
  });
  primeCache(`/generated-contents/${data.id}`, data);
  invalidateCache(`/materials/${id}/generated-contents`);
  return data;
}

export async function generatePodcast(id: string, force_regenerate: boolean = false): Promise<GeneratedContent> {
  const data = await apiFetch<GeneratedContent>(`/materials/${id}/generate/podcast`, {
    method: "POST",
    body: JSON.stringify({ 
      style: "lecturer", 
      target_duration_minutes: 8,
      force_regenerate
    }),
  });
  primeCache(`/generated-contents/${data.id}`, data);
  invalidateCache(`/materials/${id}/generated-contents`);
  return data;
}

export async function generateMinigame(
  id: string, 
  gameType: "quiz_mixed" | "flashcard" | "shooting_quiz" = "quiz_mixed",
  difficulty: "easy" | "medium" | "hard" = "medium",
  force_regenerate: boolean = false
): Promise<GeneratedContent> {
  const data = await apiFetch<GeneratedContent>(`/materials/${id}/generate/minigame`, {
    method: "POST",
    body: JSON.stringify({ game_type: gameType, difficulty, force_regenerate }),
    cacheTtlMs: gameType === "shooting_quiz" ? 180000 : 60000,
  });
  invalidateCache(`/materials/${id}/generated-contents`);
  return data;
}

export async function generateKnowledgeGraph(
  id: string,
  force_regenerate: boolean = false
): Promise<GeneratedContent> {
  const data = await apiFetch<GeneratedContent>(`/materials/${id}/generate/knowledge-graph`, {
    method: "POST",
    body: JSON.stringify({ force_regenerate }),
    skipCache: true,
  });
  invalidateCache(`/materials/${id}/generated-contents`);
  return data;
}

export async function listGeneratedContents(materialId: string, contentType?: string): Promise<GeneratedContent[]> {
  const params = contentType ? `?content_type=${contentType}` : "";
  return apiFetch<GeneratedContent[]>(`/materials/${materialId}/generated-contents${params}`);
}

export async function deleteGeneratedContent(id: string): Promise<void> {
  await apiFetch<void>(`/generated-contents/${id}`, { method: "DELETE" });
  invalidateCache("/materials/");
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
  confirm: boolean = false,
  force_regenerate: boolean = false
): Promise<NotebookLMResponse> {
  const data = await apiFetch<NotebookLMResponse>(`/materials/${materialId}/generate/notebooklm-media`, {
    method: "POST",
    body: JSON.stringify({ guidance: guidance || null, confirm, force_regenerate }),
  });
  if (data.status === "saved") {
    invalidateCache(`/materials/${materialId}/generated-contents`);
  }
  return data;
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
    body: JSON.stringify({}),
  });
  primeCache(`/chat/sessions/${session.id}`, { session, messages: [] });
  return session;
}

export async function listChatSessions(materialId: string): Promise<{ sessions: ChatSession[] }> {
  return apiFetch<{ sessions: ChatSession[] }>(`/chat/${materialId}/sessions`);
}

export async function getChatSession(sessionId: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
  return apiFetch<{ session: ChatSession; messages: ChatMessage[] }>(`/chat/sessions/${sessionId}`);
}

export async function getMascotChatSession(
  sessionId: string
): Promise<{ session: MascotChatSession; messages: MascotChatMessage[] }> {
  return apiFetch<{ session: MascotChatSession; messages: MascotChatMessage[] }>(`/chat/mascot/sessions/${sessionId}`, {
    skipCache: true,
  });
}

export async function listMascotChatSessions(): Promise<{ sessions: MascotChatSession[] }> {
  return apiFetch<{ sessions: MascotChatSession[] }>("/chat/mascot/sessions", {
    skipCache: true,
  });
}

export async function deleteChatSession(sessionId: string): Promise<DeleteSessionsResult> {
  const result = await apiFetch<DeleteSessionsResult>(`/chat/sessions/${sessionId}`, {
    method: "DELETE",
  });
  invalidateCache(`/chat/sessions/${sessionId}`, "/chat/");
  return result;
}

export async function deleteChatSessionsByMaterial(materialId: string): Promise<DeleteSessionsResult> {
  const result = await apiFetch<DeleteSessionsResult>(`/chat/${materialId}/sessions`, {
    method: "DELETE",
  });
  invalidateCache("/chat/");
  return result;
}

export async function deleteMascotChatSession(sessionId: string): Promise<DeleteSessionsResult> {
  const result = await apiFetch<DeleteSessionsResult>(`/chat/mascot/sessions/${sessionId}`, {
    method: "DELETE",
  });
  invalidateCache(`/chat/mascot/sessions/${sessionId}`, "/chat/mascot/sessions");
  return result;
}

export async function deleteAllMascotChatSessions(): Promise<DeleteSessionsResult> {
  const result = await apiFetch<DeleteSessionsResult>("/chat/mascot/sessions", {
    method: "DELETE",
  });
  invalidateCache("/chat/mascot/sessions");
  return result;
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
  images?: string[],
  options?: { model?: string | null; reasoningEnabled?: boolean; useGeminiRotation?: boolean }
): Promise<ChatMessage> {
  const chatMessage = await apiFetch<ChatMessage>(`/chat/sessions/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify({
      message,
      images: images || [],
      model: options?.model || null,
      reasoning_enabled: options?.reasoningEnabled || false,
      use_gemini_rotation: options?.useGeminiRotation ?? true,
    }),
  });
  invalidateCache(`/chat/sessions/${sessionId}`);
  return chatMessage;
}

export async function streamChatMessage(
  sessionId: string,
  message: string,
  onChunk: (chunk: { content: string; reasoning: string; citations?: any[]; model?: string; done?: boolean }) => void,
  images?: string[],
  options?: { model?: string | null; reasoningEnabled?: boolean; useGeminiRotation?: boolean }
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/sessions/${sessionId}/message/stream`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      images: images || [],
      model: options?.model || null,
      reasoning_enabled: options?.reasoningEnabled || false,
      use_gemini_rotation: options?.useGeminiRotation ?? true,
    }),
  });

  if (!response.ok) {
    let errMessage = `Error ${response.status}: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (errBody.detail) errMessage = errBody.detail;
    } catch {}
    throw new Error(errMessage);
  }

  if (!response.body) {
    throw new Error("ReadableStream not yet supported in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          onChunk(parsed);
        } catch (e) {
          console.warn("Failed to parse chunk:", line);
        }
      }
    }
    if (buffer.trim()) {
       try {
           const parsed = JSON.parse(buffer);
           onChunk(parsed);
       } catch (e) {}
    }
  } finally {
     invalidateCache(`/chat/sessions/${sessionId}`);
     invalidateCache("/chat/");
  }
}

export async function sendMascotChatMessage(
  message: string,
  sessionId?: string,
  images?: string[],
  options?: { useWebSearch?: boolean; useGoogle?: boolean; model?: string | null; reasoningEnabled?: boolean; useGeminiRotation?: boolean }
): Promise<MascotChatResponse> {
  const result = await apiFetch<MascotChatResponse>("/chat/mascot/message", {
    method: "POST",
    body: JSON.stringify({
      message,
      session_id: sessionId || null,
      images: images || [],
      use_web_search: options?.useWebSearch ?? false,
      use_google: options?.useGoogle ?? true,
      model: options?.model || null,
      reasoning_enabled: options?.reasoningEnabled || false,
      use_gemini_rotation: options?.useGeminiRotation ?? true,
    }),
  });
  invalidateCache("/chat/mascot/sessions");
  invalidateCache(`/chat/mascot/sessions/${result.session_id}`);
  return result;
}

export async function streamMascotChatMessage(
  message: string,
  onChunk: (chunk: { content: string; reasoning: string; model?: string; session_id?: string; done?: boolean }) => void,
  sessionId?: string,
  images?: string[],
  options?: { useWebSearch?: boolean; useGoogle?: boolean; model?: string | null; reasoningEnabled?: boolean; useGeminiRotation?: boolean }
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/mascot/message/stream`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      session_id: sessionId || null,
      images: images || [],
      use_web_search: options?.useWebSearch ?? false,
      use_google: options?.useGoogle ?? true,
      model: options?.model || null,
      reasoning_enabled: options?.reasoningEnabled || false,
      use_gemini_rotation: options?.useGeminiRotation ?? true,
    }),
  });

  if (!response.ok) {
    let errMessage = `Error ${response.status}: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (errBody.detail) errMessage = errBody.detail;
    } catch {}
    throw new Error(errMessage);
  }

  if (!response.body) {
    throw new Error("ReadableStream not yet supported in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          onChunk(parsed);
          if (parsed.session_id) {
            invalidateCache(`/chat/mascot/sessions/${parsed.session_id}`);
          }
        } catch (e) {
          console.warn("Failed to parse chunk:", line);
        }
      }
    }
    if (buffer.trim()) {
       try {
           const parsed = JSON.parse(buffer);
           onChunk(parsed);
          if (parsed.session_id) {
            invalidateCache(`/chat/mascot/sessions/${parsed.session_id}`);
          }
       } catch (e) {}
    }
  } finally {
    invalidateCache("/chat/mascot/sessions");
  }
}

export async function webSearch(
  sessionId: string,
  query: string,
  useGoogle: boolean = true,
  options?: { model?: string | null; useGeminiRotation?: boolean; reasoningEnabled?: boolean }
): Promise<any> {
  const result = await apiFetch<any>(`/chat/sessions/${sessionId}/web-search`, {
    method: "POST",
    body: JSON.stringify({
      query,
      use_google: useGoogle,
      model: options?.model || null,
      use_gemini_rotation: options?.useGeminiRotation ?? true,
      reasoning_enabled: options?.reasoningEnabled ?? false,
    }),
  });
  invalidateCache(`/chat/sessions/${sessionId}`);
  return result;
}

export async function streamWebSearch(
  sessionId: string,
  query: string,
  onChunk: (chunk: { content?: string; reasoning?: string; citations?: any[]; model?: string; done?: boolean; search_provider?: string }) => void,
  options?: { useGoogle?: boolean; model?: string | null; useGeminiRotation?: boolean; reasoningEnabled?: boolean }
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/sessions/${sessionId}/web-search/stream`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      use_google: options?.useGoogle ?? true,
      model: options?.model || null,
      use_gemini_rotation: options?.useGeminiRotation ?? true,
      reasoning_enabled: options?.reasoningEnabled ?? false,
    }),
  });

  if (!response.ok) {
    let errMessage = `Error ${response.status}: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (errBody.detail) errMessage = errBody.detail;
    } catch {}
    throw new Error(errMessage);
  }

  if (!response.body) {
    throw new Error("ReadableStream not yet supported in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          onChunk(parsed);
        } catch {
          console.warn("Failed to parse chunk:", line);
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        onChunk(parsed);
      } catch {}
    }
  } finally {
    invalidateCache(`/chat/sessions/${sessionId}`);
    invalidateCache("/chat/");
  }
}

export async function searchDuckDuckGo(
  query: string,
  searchType: DuckDuckGoSearchType = "text",
  maxResults: number = 10
): Promise<DuckDuckGoSearchItem[]> {
  const params = new URLSearchParams({
    q: query,
    type: searchType,
    max_results: String(maxResults),
  });

  return apiFetch<DuckDuckGoSearchItem[]>(`/web-search/duckduckgo?${params.toString()}`, {
    skipCache: true,
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
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth-required"));
    throw new Error("Vui lòng đăng nhập trước khi thực hiện chức năng này.");
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<{ text: string }>;
}

export async function synthesizeChatSpeech(text: string, lang: string = "vi"): Promise<Blob> {
  const response = await fetch(`${API_BASE}/chat/tts`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, lang }),
    cache: "no-store",
  });

  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth-required"));
    throw new Error("Vui lòng đăng nhập trước khi thực hiện chức năng này.");
  }

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
    body: JSON.stringify({ answers }),
  });
}

export async function getMinigamePersonalization(materialId: string): Promise<MinigamePersonalization> {
  return apiFetch<MinigamePersonalization>(`/games/materials/${materialId}/personalization`, {
    skipCache: true,
  });
}

export async function generateRemediationQuickStart(
  materialId: string,
  payload?: {
    difficulty?: "easy" | "medium" | "hard";
    top_k_wrong_questions?: number;
  }
): Promise<RemediationQuickStart> {
  return apiFetch<RemediationQuickStart>(`/games/materials/${materialId}/remediation-quick-start`, {
    method: "POST",
    body: JSON.stringify({
      difficulty: payload?.difficulty,
      top_k_wrong_questions: payload?.top_k_wrong_questions ?? 10,
    }),
  });
}

export interface YouTubeVideoItem {
  video_id: string;
  title: string;
  channel?: string | null;
  duration_seconds?: number | null;
  thumbnail?: string | null;
  url: string;
}

export interface YouTubeTranscriptSegment {
  text: string;
  start: number;
  duration: number;
  timestamp: string;
}

export interface InteractiveCheckpoint {
  start_seconds: number;
  timestamp: string;
  title: string;
  key_point: string;
  question: string;
  choices: string[];
  correct_answer_index: number;
  explanation: string;
}

export interface LessonChapterItem {
  timestamp: string;
  title: string;
}

export interface LessonKeyNoteItem {
  time: string;
  note: string;
}

export interface InteractiveLessonPayload {
  summary: string;
  key_takeaways: string[];
  chapters: LessonChapterItem[];
  key_notes: LessonKeyNoteItem[];
  checkpoints: InteractiveCheckpoint[];
}

export interface YouTubeInteractiveLessonResponse {
  video: YouTubeVideoItem;
  transcript: YouTubeTranscriptSegment[];
  lesson: InteractiveLessonPayload;
  translations?: Record<string, YouTubeTranscriptSegment[]>;
}

export interface YouTubeLessonHistorySummary {
  id: string;
  video: YouTubeVideoItem;
  created_at: string;
  updated_at: string;
}

export interface YouTubeLessonHistoryDetail {
  id: string;
  video: YouTubeVideoItem;
  transcript: YouTubeTranscriptSegment[];
  lesson: InteractiveLessonPayload;
  translations?: Record<string, YouTubeTranscriptSegment[]>;
  created_at: string;
  updated_at: string;
}

export interface YouTubeTranslateTranscriptResponse {
  transcript: YouTubeTranscriptSegment[];
  target_language: string;
}

export async function searchYouTubeVideos(query: string, limit: number = 6): Promise<YouTubeVideoItem[]> {
  const result = await apiFetch<{ items: YouTubeVideoItem[] }>("/youtube-lessons/search", {
    method: "POST",
    body: JSON.stringify({ query, limit }),
    skipCache: true,
  });
  return result.items;
}

export async function generateInteractiveYouTubeLesson(payload: {
  youtube_url?: string;
  video_id?: string;
  query?: string;
  manual_transcript?: string;
  max_checkpoints?: number;
  stt_model?: SttModel;
}): Promise<YouTubeInteractiveLessonResponse> {
  return apiFetch<YouTubeInteractiveLessonResponse>("/youtube-lessons/interactive", {
    method: "POST",
    body: JSON.stringify(payload),
    skipCache: true,
  });
}

export async function listYouTubeLessonHistory(
  skip: number = 0,
  limit: number = 20
): Promise<{ items: YouTubeLessonHistorySummary[]; total: number }> {
  return apiFetch<{ items: YouTubeLessonHistorySummary[]; total: number }>(
    `/youtube-lessons/history?skip=${skip}&limit=${limit}`,
    { skipCache: true }
  );
}

export async function getYouTubeLessonHistoryDetail(id: string): Promise<YouTubeLessonHistoryDetail> {
  return apiFetch<YouTubeLessonHistoryDetail>(`/youtube-lessons/history/${id}`, {
    skipCache: true,
  });
}

export async function deleteYouTubeLessonHistory(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/youtube-lessons/history/${id}`, {
    method: "DELETE",
    skipCache: true,
  });
}

export async function translateYouTubeTranscript(
  transcript: YouTubeTranscriptSegment[],
  targetLanguage: string,
  videoId?: string
): Promise<YouTubeTranslateTranscriptResponse> {
  return apiFetch<YouTubeTranslateTranscriptResponse>("/youtube-lessons/translate-transcript", {
    method: "POST",
    body: JSON.stringify({ 
      transcript, 
      target_language: targetLanguage,
      video_id: videoId 
    }),
    skipCache: true,
  });
}

type FileUrlMode = "download" | "preview";

function getApiHost(): string {
  return process.env.NEXT_PUBLIC_API_HOST || "http://localhost:8000";
}

export function apiFileUrl(fileUrl: string, mode: FileUrlMode = "download"): string {
  if (!fileUrl) return "#";

  const apiHost = getApiHost();

  if (fileUrl.startsWith("/api/files/")) {
    if (mode === "preview") {
      return `${apiHost}${fileUrl.replace(/\/download$/, "/preview")}`;
    }
    return `${apiHost}${fileUrl}`;
  }

  if (/^https?:\/\//i.test(fileUrl)) {
    return `${apiHost}/api/files/${encodeURIComponent(fileUrl)}/${mode}`;
  }

  if (fileUrl.startsWith("/")) {
    return `${apiHost}${fileUrl}`;
  }

  return `${apiHost}/api/files/${encodeURIComponent(fileUrl)}/${mode}`;
}

export function apiDownloadUrl(fileUrl: string): string {
  return apiFileUrl(fileUrl, "download");
}

export function apiPreviewUrl(fileUrl: string): string {
  return apiFileUrl(fileUrl, "preview");
}
