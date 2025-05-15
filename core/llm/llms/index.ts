import {
  BaseCompletionOptions,
  IdeSettings,
  ILLM,
  ILLMLogger,
  JSONModelDescription,
  LLMOptions,
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
import OVHcloud from "./OVHcloud";
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
import Venice from "./Venice";
import VertexAI from "./VertexAI";
import Vllm from "./Vllm";
import Voyage from "./Voyage";
import WatsonX from "./WatsonX";
import xAI from "./xAI";

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
  OVHcloud,
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
  Venice,
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
    baseAgentSystemMessage: baseChatSystemMessage,
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
