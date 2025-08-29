import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { Session } from "core/index.js";

import { ToolCallPreview } from "../../tools/types.js";

export interface UseChatProps {
  assistant?: AssistantUnrolled;
  model?: ModelConfig;
  llmApi?: BaseLlmApi;
  initialPrompt?: string;
  resume?: boolean;
  additionalRules?: string[];
  additionalPrompts?: string[];
  onShowConfigSelector: () => void;
  onShowMCPSelector: () => void;
  onShowModelSelector?: () => void;
  onShowSessionSelector?: () => void;
  onLoginPrompt?: (promptText: string) => Promise<string>;
  onReload?: () => Promise<void>;
  onClear?: () => void;
  // Remote mode props
  isRemoteMode?: boolean;
  remoteUrl?: string;
}

export interface AttachedFile {
  path: string;
  content: string;
}

export interface ActivePermissionRequest {
  toolName: string;
  toolArgs: any;
  requestId: string;
  toolCallPreview?: ToolCallPreview[];
}

export interface RemoteServerState {
  session: Session;
  isProcessing: boolean;
  messageQueueLength: number;
  pendingPermission?: {
    toolName: string;
    toolArgs: any;
    requestId: string;
    toolCallPreview?: any[];
  };
}

export interface SlashCommandResult {
  output?: string;
  exit?: boolean;
  newInput?: string;
  clear?: boolean;
  openConfigSelector?: boolean;
  openModelSelector?: boolean;
  openMcpSelector?: boolean;
  openSessionSelector?: boolean;
  compact?: boolean;
}
