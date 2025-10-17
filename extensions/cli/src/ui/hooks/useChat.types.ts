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
  fork?: string;
  additionalRules?: string[];
  additionalPrompts?: string[];
  onShowConfigSelector: () => void;
  onShowMCPSelector: () => void;
  onShowUpdateSelector: () => void;
  onShowModelSelector?: () => void;
  onShowSessionSelector?: () => void;
  onReload?: () => Promise<void>;
  onClear?: () => void;
  onRefreshStatic?: () => void;
  // Remote mode props
  isRemoteMode?: boolean;
  remoteUrl?: string;
  onShowDiff?: (diffContent: string) => void;
  onShowStatusMessage?: (message: string) => void;
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
  hasDynamicEvaluation?: boolean;
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
  openUpdateSelector?: boolean;
  openSessionSelector?: boolean;
  compact?: boolean;
  diffContent?: string;
}
