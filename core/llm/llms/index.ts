import {
  BaseCompletionOptions,
  IdeSettings,
  ILLM,
  ILLMLogger,
  JSONModelDescription,
  LLMOptions,
  ModelCapability,
} from "../..";
import { renderTemplatedString } from "../../promptFiles/v1/renderTemplatedString";
import { DEFAULT_CHAT_SYSTEM_MESSAGE } from "../constructMessages";
import { BaseLLM } from "../index";

import Anthropic from "./Anthropic";
import Asksage from "./Asksage";
import Azure from "./Azure";
import Bedrock from "./Bedrock";
import BedrockImport from "./BedrockImport";
import Cerebras from "./Cerebras";
import Cloudflare from "./Cloudflare";
import Cohere from "./Cohere";
import DeepInfra from "./DeepInfra";
import Deepseek from "./Deepseek";
import Docker from "./Docker";
import Fireworks from "./Fireworks";
import Flowise from "./Flowise";
import FreeTrial from "./FreeTrial";
import FunctionNetwork from "./FunctionNetwork";
import Gemini from "./Gemini";
import Groq from "./Groq";
import HuggingFaceInferenceAPI from "./HuggingFaceInferenceAPI";
import HuggingFaceTEIEmbeddingsProvider from "./HuggingFaceTEI";
import HuggingFaceTGI from "./HuggingFaceTGI";
import Inception from "./Inception";
import Kindo from "./Kindo";
import LlamaCpp from "./LlamaCpp";
import Llamafile from "./Llamafile";
import LMStudio from "./LMStudio";
import Mistral from "./Mistral";
import MockLLM from "./Mock";
import Moonshot from "./Moonshot";
import Msty from "./Msty";
import NCompass from "./NCompass";
import Nebius from "./Nebius";
import Novita from "./Novita";
import Nvidia from "./Nvidia";
import Ollama from "./Ollama";
import OpenAI from "./OpenAI";
import OpenRouter from "./OpenRouter";
import { Relace } from "./Relace";
import Replicate from "./Replicate";
import SageMaker from "./SageMaker";
import SambaNova from "./SambaNova";
import Scaleway from "./Scaleway";
import SiliconFlow from "./SiliconFlow";
import ContinueProxy from "./stubs/ContinueProxy";
import TestLLM from "./Test";
import TextGenWebUI from "./TextGenWebUI";
import Together from "./Together";
import VertexAI from "./VertexAI";
import Vllm from "./Vllm";
import Voyage from "./Voyage";
import WatsonX from "./WatsonX";
import xAI from "./xAI";

// ThinkingPanel関連のコマンド定数
export const THINKING_COMMANDS = {
  RESET_THINKING_PANEL: 'continue.resetThinkingPanel',
  APPEND_THINKING_CHUNK: 'continue.appendThinkingChunk',
  FORCE_REFRESH_THINKING: 'continue.forceRefreshThinking',
  THINKING_COMPLETED: 'continue.thinkingCompleted',
  SHOW_THINKING_PANEL: 'continue.showThinkingPanel',
  VIEW_LOGS: 'continue.viewLogs',
  NEW_SESSION: 'continue.newSession',
  TOGGLE_THINKING_PANEL: 'continue.toggleThinkingPanel'
};

// ThinkingConfig インターフェースの定義
export interface ThinkingConfig {
  type: "enabled" | "disabled" | "auto";
  budget_tokens?: number;
}

// ThinkingContent インターフェースの定義（ChatMessageとは別のインターフェース）
export interface ThinkingContent {
  type: "thinking";
  thinking: string;
  metadata?: {
    phase: string;
    progress: number;
    tokens?: number;
    elapsed_ms?: number;
  };
}

// ThinkingPanel関連の機能
// 直接Databricksからインポートせず、thinkingPanelを使用
import { registerThinkingPanel, updateThinking, thinkingCompleted } from './thinkingPanel';
export { registerThinkingPanel, updateThinking, thinkingCompleted };

// VSCode拡張のコンテキストを保持する変数
let _extensionContext: any = null;

// 拡張機能のコンテキストを設定する関数
export function setExtensionContext(context: any) {
  console.log("Setting extension context in core/llm/llms/index.ts");
  _extensionContext = context;
  
  // ThinkingPanelのセットアップ
  if (context) {
    try {
      registerThinkingPanel(context);
      console.log("Thinking panel registered via setExtensionContext");
    } catch (e) {
      console.error("Error registering thinking panel:", e);
    }
  } else {
    console.warn("Extension context is null or undefined");
  }
}

// 拡張機能のコンテキストを取得する関数
export function getExtensionContext() {
  return _extensionContext;
}

// Databricksは循環参照を避けるため個別にインポート
import Databricks from "./Databricks";
import DatabricksThinking from "./DatabricksThinking";
export { DatabricksThinking };

export const LLMClasses = [
  Anthropic,
  Cohere,
  FreeTrial,
  FunctionNetwork,
  Gemini,
  Llamafile,
  Moonshot,
  Ollama,
  Replicate,
  TextGenWebUI,
  Together,
  Novita,
  HuggingFaceTGI,
  HuggingFaceTEIEmbeddingsProvider,
  HuggingFaceInferenceAPI,
  Kindo,
  LlamaCpp,
  OpenAI,
  LMStudio,
  Mistral,
  Bedrock,
  BedrockImport,
  SageMaker,
  DeepInfra,
  Flowise,
  Groq,
  Fireworks,
  NCompass,
  ContinueProxy,
  Cloudflare,
  Deepseek,
  Databricks,
  Docker,
  Msty,
  Azure,
  WatsonX,
  OpenRouter,
  Nvidia,
  Vllm,
  SambaNova,
  MockLLM,
  TestLLM,
  Cerebras,
  Asksage,
  Nebius,
  VertexAI,
  xAI,
  SiliconFlow,
  Scaleway,
  Relace,
  Inception,
  Voyage,
];

export async function llmFromDescription(
  desc: JSONModelDescription,
  readFile: (filepath: string) => Promise<string>,
  uniqueId: string,
  ideSettings: IdeSettings,
  llmLogger: ILLMLogger,
  completionOptions?: BaseCompletionOptions,
): Promise<BaseLLM | undefined> {
  const cls = LLMClasses.find((llm) => llm.providerName === desc.provider);

  if (!cls) {
    return undefined;
  }

  const finalCompletionOptions = {
    ...completionOptions,
    ...desc.completionOptions,
  };

  let baseChatSystemMessage: string | undefined = undefined;
  if (desc.systemMessage !== undefined) {
    baseChatSystemMessage = DEFAULT_CHAT_SYSTEM_MESSAGE;
    baseChatSystemMessage += "\n\n";
    baseChatSystemMessage += await renderTemplatedString(
      desc.systemMessage,
      readFile,
      {},
    );
  }

  let options: LLMOptions = {
    ...desc,
    completionOptions: {
      ...finalCompletionOptions,
      model: (desc.model || cls.defaultOptions?.model) ?? "codellama-7b",
      maxTokens:
        finalCompletionOptions.maxTokens ??
        cls.defaultOptions?.completionOptions?.maxTokens,
    },
    baseChatSystemMessage,
    logger: llmLogger,
    uniqueId,
  };

  if (desc.provider === "continue-proxy") {
    options.apiKey = ideSettings.userToken;
    if (ideSettings.remoteConfigServerUrl) {
      options.apiBase = new URL(
        "/proxy/v1",
        ideSettings.remoteConfigServerUrl,
      ).toString();
    }
  }

  return new cls(options);
}

export function llmFromProviderAndOptions(
  providerName: string,
  llmOptions: LLMOptions,
): ILLM {
  const cls = LLMClasses.find((llm) => llm.providerName === providerName);

  if (!cls) {
    throw new Error(`Unknown LLM provider type "${providerName}"`);
  }

  return new cls(llmOptions);
}