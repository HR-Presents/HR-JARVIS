export interface Message {
  role: "user" | "assistant";
  content: string;
  events?: unknown[];
}
export interface Reply {
  response: string;
  conversation_id?: string;
  events?: unknown[];
}
export interface Conversation {
  id: string;
  title?: string;
  created_at?: string;
  message_count?: number;
  updated_at?: string;
}
export interface Approval {
  id: string;
  path: string;
  reason: string;
  status: string;
  content?: string;
}
export interface Source {
  title: string;
  url: string;
  snippet: string;
  citation?: string;
}
export interface Research {
  answer?: string;
  sources?: Source[];
  results?: Source[];
}
export interface VoiceReply extends Reply {
  transcription: string;
  audio_base64: string;
  history: Message[];
}
export type Status = Record<string, unknown>;
