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
}

type ChatHistory = ChatHistoryItem[];

export {
  CompletionOptions,
  ChatMessage,
  ChatMessageRole,
  ChatHistory,
  ChatHistoryItem,
  ContextItem,
  ContextItemId,
};
