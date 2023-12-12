interface CompletionOptions {
  model: string;

  maxTokens: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: string[];
}

type ChatMessageRole = "user" | "assistant" | "system";

interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

interface ContextItemId {
  providerTitle: string;
  itemId: string;
}

interface ContextItem {
  content: string;
  name: string;
  description: string;
  id: ContextItemId;
  editing?: boolean;
  editable?: boolean;
}

interface ChatHistoryItem {
  message: ChatMessage;
  contextItems: ContextItem[];
  promptLogs?: [string, string][]; // [prompt, completion]
}

type ChatHistory = ChatHistoryItem[];

export {
  ChatHistory,
  ChatHistoryItem,
  ChatMessage,
  ChatMessageRole,
  CompletionOptions,
  ContextItem,
  ContextItemId,
};
