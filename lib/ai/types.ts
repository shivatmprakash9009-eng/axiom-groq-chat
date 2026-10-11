export type ProviderName = "gemini" | "groq" | "openai" | "anthropic";

export type MessageRole = "user" | "assistant" | "system";

export interface ConversationMessage {
  role: MessageRole;
  content: string;
}

export type ChatStyle = "default" | "concise" | "detailed" | "code";

export interface ChatOptions {
  stream?: boolean;
  style?: ChatStyle;
  customSystemPrompt?: string;
  temperature?: number;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatResult {
  message: string;
  provider: ProviderName;
  model: string;
  latencyMs: number;
  usage?: TokenUsage;
}

export interface StreamChunk {
  text: string;
  done: boolean;
  provider?: ProviderName;
  model?: string;
  usage?: TokenUsage;
}

export interface ProviderStatus {
  name: ProviderName;
  configured: boolean;
  model: string;
  priority: number;
}
