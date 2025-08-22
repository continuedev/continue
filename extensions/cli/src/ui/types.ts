export interface DisplayMessage {
  role: string;
  content: string;
  isStreaming?: boolean;
  messageType?:
    | "tool-start"
    | "tool-result"
    | "tool-error"
    | "system"
    | "tool-permission-request"
    | "compaction";
  toolName?: string;
  toolResult?: string;
  toolArgs?: any;
  permissionRequestId?: string;
}
