export type Material = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  subject?: string;
  education_level?: string;
  source_type: string;
  file_name?: string;
  file_url?: string;
  tags: string[];
  processing_status: "uploaded" | "queued" | "processing" | "processed" | "failed";
  raw_text?: string;
  cleaned_text?: string;
  created_at: string;
  updated_at: string;
};

export type GeneratedContent = {
  id: string;
  material_id: string;
  content_type: "slides" | "podcast" | "minigame" | "chatbot_config" | "quiz";
  version: number;
  outline: string[];
  json_content: Record<string, any>;
  file_url?: string;
  generation_status: "queued" | "generating" | "generated" | "failed";
  created_at: string;
  updated_at: string;
};

export type ChatSession = {
  id: string;
  user_id: string;
  material_id: string;
  session_title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  message: string;
  citations: Array<{
    material_id: string;
    chunk_id: string;
    chunk_index: number;
    snippet: string;
  }>;
  created_at: string;
};
