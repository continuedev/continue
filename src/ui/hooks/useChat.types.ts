import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { ChatCompletionMessageParam } from "openai/resources.mjs";

import { ToolCallPreview } from "../../tools/types.js";

export interface UseChatProps {
  assistant?: AssistantUnrolled;
  model?: ModelConfig;
  llmApi?: BaseLlmApi;
  initialPrompt?: string;
  resume?: boolean;
  additionalRules?: string[];
  onShowOrgSelector: () => void;
  onShowConfigSelector: () => void;
  onShowMCPSelector: () => void;
  onShowModelSelector?: () => void;
  onLoginPrompt?: (promptText: string) => Promise<string>;
  onReload?: () => Promise<void>;
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
  messages: Array<{
    role: string;
    content?: string;
    tool_calls?: any[];
  }>;
  chatHistory: ChatCompletionMessageParam[];
  isProcessing: boolean;
  activePermissionRequest?: {
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
  compact?: boolean;
  model?: string;
}
