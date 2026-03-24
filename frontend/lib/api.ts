import { ChatMessage, ChatSession, GeneratedContent, Material } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function listMaterials(): Promise<{ items: Material[]; total: number }> {
  return apiFetch<{ items: Material[]; total: number }>("/materials");
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

export async function generateMinigame(id: string): Promise<GeneratedContent> {
  return apiFetch<GeneratedContent>(`/materials/${id}/generate/minigame`, {
    method: "POST",
    body: JSON.stringify({ game_types: ["mcq", "fill_blank", "matching", "flashcard"] }),
  });
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

export async function sendChatMessage(sessionId: string, message: string): Promise<ChatMessage> {
  return apiFetch<ChatMessage>(`/chat/sessions/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function submitGameAttempt(
  generatedContentId: string,
  answers: Array<{ id: string; answer: string }>
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
