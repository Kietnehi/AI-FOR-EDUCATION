import { ChatMessage, ChatSession, GeneratedContent, Material, MascotChatResponse } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

async function apiFetch<T>(path: string, options?: RequestInit, timeoutMs: number = 60000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error: any) {
    clearTimeout(timeout);
    if (error?.name === "AbortError") {
      throw new Error("Request timeout: Backend is taking too long to respond.");
    }
    throw error;
  }

  clearTimeout(timeout);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function listMaterials(): Promise<{ items: Material[]; total: number }> {
  return apiFetch<{ items: Material[]; total: number }>("/materials");
}

export async function deleteMaterial(id: string): Promise<void> {
  return apiFetch<void>(`/materials/${id}`, { method: "DELETE" });
}

export async function getMaterial(id: string): Promise<Material> {
  return apiFetch<Material>(`/materials/${id}`);
}

export async function processMaterial(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/materials/${id}/process`, {
    method: "POST",
    body: JSON.stringify({ force_reprocess: false }),
  });
}

export async function generateSlides(id: string): Promise<GeneratedContent> {
  return apiFetch<GeneratedContent>(`/materials/${id}/generate/slides`, {
    method: "POST",
    body: JSON.stringify({ tone: "teacher", max_slides: 8 }),
  });
}

export async function generatePodcast(id: string): Promise<GeneratedContent> {
  return apiFetch<GeneratedContent>(`/materials/${id}/generate/podcast`, {
    method: "POST",
    body: JSON.stringify({ style: "lecturer", target_duration_minutes: 8 }),
  });
}

export async function generateMinigame(id: string, gameType: "quiz_mixed" | "flashcard" | "scenario_branching" = "quiz_mixed"): Promise<GeneratedContent> {
  return apiFetch<GeneratedContent>(`/materials/${id}/generate/minigame`, {
    method: "POST",
    body: JSON.stringify({ game_type: gameType }),
  }, gameType === "scenario_branching" ? 180000 : 60000);
}

export async function getGeneratedContent(id: string): Promise<GeneratedContent> {
  return apiFetch<GeneratedContent>(`/generated-contents/${id}`);
}

export async function createChatSession(materialId: string): Promise<ChatSession> {
  return apiFetch<ChatSession>(`/chat/${materialId}/session`, {
    method: "POST",
    body: JSON.stringify({ user_id: "demo-user" }),
  });
}

export async function getChatSession(sessionId: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
  return apiFetch<{ session: ChatSession; messages: ChatMessage[] }>(`/chat/sessions/${sessionId}`);
}

export async function sendChatMessage(sessionId: string, message: string, images?: string[]): Promise<ChatMessage> {
  return apiFetch<ChatMessage>(`/chat/sessions/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify({ message, images: images || [] }),
  });
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
  sttModel: "local-base" | "whisper-large-v3" | "whisper-large-v3-turbo"
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
