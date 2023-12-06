interface CompletionOptions {
  model: string;

  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: string[];
  maxTokens: number;
}

interface RequestOptions {
  timeout?: number;
  verifySsl?: boolean;
  caBundlePath: string;
  proxy?: string;
  headers?: Record<string, string>;
}

type ChatMessageRole = "user" | "assistant" | "system";

interface ChatMessage {
  role: ChatMessageRole;
  content: string;
  name?: string;
  summary: string;
}

interface ContextItem {
  content: string;
  name: string;
  description: string;
  providerTitle: string;
  itemId: string;
}

interface ChatHistoryItem {
  message: ChatMessage;
  contextItems: ContextItem[];
}

type ChatHistory = ChatHistoryItem[];

export {
  CompletionOptions,
  RequestOptions,
  ChatMessage,
  ChatMessageRole,
  ChatHistory,
  ChatHistoryItem,
  ContextItem,
};
