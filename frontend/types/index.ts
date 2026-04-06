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
  storage_type?: "local" | "minio" | "r2" | "none" | string;
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
  content_type:
    | "slides"
    | "podcast"
    | "minigame"
    | "chatbot_config"
    | "quiz"
    | "video"
    | "infographic";
  game_type?: "quiz_mixed" | "flashcard" | "shooting_quiz";
  difficulty?: "easy" | "medium" | "hard" | string;
  version: number;
  outline: string[];
  json_content: Record<string, any>;
  file_url?: string;
  storage_type?: "local" | "minio" | "r2" | "none" | string;
  generation_status: "queued" | "generating" | "generated" | "failed";
  model_used?: string | null;
  fallback_applied?: boolean;
  created_at: string;
  updated_at: string;
};

export type GameTypePersonalizationStat = {
  game_type: "quiz_mixed" | "flashcard" | "shooting_quiz" | string;
  attempts: number;
  average_accuracy: number;
  recommended_difficulty: "easy" | "medium" | "hard" | string;
  last_played_difficulty: "easy" | "medium" | "hard" | string;
};

export type MinigamePersonalization = {
  material_id: string;
  total_attempts: number;
  average_accuracy: number;
  suggested_game_type: "quiz_mixed" | "flashcard" | "shooting_quiz" | string;
  recommended_difficulty: "easy" | "medium" | "hard" | string;
  streak_days: number;
  game_type_stats: GameTypePersonalizationStat[];
  weak_points: string[];
  next_actions: string[];
};

export type RemediationQuickStartItem = {
  game_type: "quiz_mixed" | string;
  generated_content_id: string;
  difficulty: "easy" | "medium" | "hard" | string;
  title: string;
};

export type RemediationWrongQuestion = {
  question: string;
  wrong_count: number;
  correct_answer?: string | null;
};

export type RemediationQuickStart = {
  material_id: string;
  weak_points: string[];
  top_wrong_questions: RemediationWrongQuestion[];
  recommended_difficulty: "easy" | "medium" | "hard" | string;
  generated_items: RemediationQuickStartItem[];
  message: string;
};

export type NotebookLMMediaFile = {
  file_name: string;
  file_url: string;
  storage_type?: "local" | "minio" | "r2" | "none" | string;
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
  status: "saved";
  session_id: string;
  videos: NotebookLMMediaFile[];
  infographics: NotebookLMMediaFile[];
};

export type NotebookLMResponse =
  | NotebookLMMediaResult
  | NotebookLMConfirmationResult
  | NotebookLMArtifactConfirmationResult
  | NotebookLMSavedResult;

export type ChatSession = {
  id: string;
  user_id: string;
  material_id: string;
  session_title: string;
  created_at: string;
  updated_at: string;
};

export type MascotChatSession = {
  id: string;
  user_id: string;
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
   search_results?: {
     sources: Array<{
       index: number;
       title: string;
       uri: string;
       snippet: string;
     }>;
     search_provider: string;
     search_queries?: string[];
   };
   is_web_search?: boolean;
   reasoning_details?: Record<string, any> | null;
   };

export type MascotChatResponse = {
  message: string;
  model: string;
  session_id: string;
  model_used?: string | null;
  fallback_applied?: boolean;
  is_web_search?: boolean;
  search_provider?: string | null;
  reasoning_details?: Record<string, any> | null;
};

export type MascotChatMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  message: string;
  created_at: string;
  images?: string[];
  model_used?: string | null;
  fallback_applied?: boolean;
  is_web_search?: boolean;
  search_provider?: string | null;
  search_results?: Record<string, any> | null;
  reasoning_details?: Record<string, any> | null;
};

export type DeleteSessionsResult = {
  deleted_count: number;
};

export type SttModel =
  | "local-base"
  | "local-small"
  | "whisper-large-v3"
  | "whisper-large-v3-turbo";

export type DuckDuckGoSearchType = "text" | "news" | "images" | "videos" | "books";

export type DuckDuckGoSearchItem = Record<string, any>;
