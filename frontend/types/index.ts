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
  guardrail_status?: string;
  guardrail_category?: string;
  guardrail_reason?: string;
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
  model_used?: string | null;
  fallback_applied?: boolean;
  created_at: string;
  updated_at: string;
};

export type NotebookLMMediaFile = {
  file_name: string;
  file_url: string;
};

export type NotebookLMMediaResult = {
  status: "generation_complete";
  session_id: string;
  material_id?: string | null;
  prompt: string;
  notebook_title?: string;
  message: string;
};

export type NotebookLMConfirmationResult = {
  status: "awaiting_confirmation";
  material_id?: string | null;
  prompt: string;
  message: string;
  estimated_duration_seconds: number;
};

export type NotebookLMArtifactConfirmationResult = {
  status: "awaiting_artifact_confirmation";
  session_id: string;
  material_id?: string | null;
  prompt: string;
  notebook_title?: string;
  message: string;
};

export type NotebookLMSavedResult = {
  session_id: string;
  videos: NotebookLMMediaFile[];
  infographics: NotebookLMMediaFile[];
};

export type NotebookLMResponse =
  | NotebookLMMediaResult
  | NotebookLMConfirmationResult
  | NotebookLMArtifactConfirmationResult;

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
  model_used?: string | null;
  fallback_applied?: boolean;
  images?: string[];
};

export type MascotChatResponse = {
  message: string;
  model: string;
  session_id: string;
  model_used?: string | null;
  fallback_applied?: boolean;
};

export type SttModel =
  | "local-base"
  | "local-small"
  | "whisper-large-v3"
  | "whisper-large-v3-turbo";
