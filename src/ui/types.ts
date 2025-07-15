export interface DisplayMessage {
  role: string;
  content: string;
  isStreaming?: boolean;
  messageType?: "tool-start" | "tool-result" | "tool-error" | "system";
  toolName?: string;
  toolResult?: string;
}
