import {
  BaseCompletionOptions,
  IdeSettings,
  ILLM,
  LLMOptions,
  ModelDescription,
} from "../..";
import { renderTemplatedString } from "../../promptFiles/v1/renderTemplatedString";
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
import Fireworks from "./Fireworks";
import Flowise from "./Flowise";
import FreeTrial from "./FreeTrial";
import Gemini from "./Gemini";
import Groq from "./Groq";
import HuggingFaceInferenceAPI from "./HuggingFaceInferenceAPI";
import HuggingFaceTGI from "./HuggingFaceTGI";
import Kindo from "./Kindo";
import LlamaCpp from "./LlamaCpp";
import Llamafile from "./Llamafile";
import LMStudio from "./LMStudio";
import Mistral from "./Mistral";
import Mock from "./Mock";
import Moonshot from "./Moonshot";
import Msty from "./Msty";
import Nebius from "./Nebius";
import Nvidia from "./Nvidia";
import Ollama from "./Ollama";
import OpenAI from "./OpenAI";
import OpenRouter from "./OpenRouter";
import Replicate from "./Replicate";
import SageMaker from "./SageMaker";
import SambaNova from "./SambaNova";
import ContinueProxy from "./stubs/ContinueProxy";
import TextGenWebUI from "./TextGenWebUI";
import Together from "./Together";
import VertexAI from "./VertexAI";
import Vllm from "./Vllm";
import WatsonX from "./WatsonX";
import xAI from "./xAI";
import SiliconFlow from "./SiliconFlow";

const LLMs = [
  Anthropic,
  Cohere,
  FreeTrial,
  Gemini,
  Llamafile,
  Moonshot,
  Ollama,
  Replicate,
  TextGenWebUI,
  Together,
  HuggingFaceTGI,
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
  ContinueProxy,
  Cloudflare,
  Deepseek,
  Msty,
  Azure,
  WatsonX,
  OpenRouter,
  Nvidia,
  Vllm,
  SambaNova,
  Mock,
  Cerebras,
  Asksage,
  Nebius,
  VertexAI,
  xAI,
  SiliconFlow,
];

export async function llmFromDescription(
  desc: ModelDescription,
  readFile: (filepath: string) => Promise<string>,
  uniqueId: string,
  ideSettings: IdeSettings,
  writeLog: (log: string) => Promise<void>,
  completionOptions?: BaseCompletionOptions,
  systemMessage?: string,
): Promise<BaseLLM | undefined> {
  const cls = LLMs.find((llm) => llm.providerName === desc.provider);

  if (!cls) {
    return undefined;
  }

  const finalCompletionOptions = {
    ...completionOptions,
    ...desc.completionOptions,
  };

  systemMessage = desc.systemMessage ?? systemMessage;
  if (systemMessage !== undefined) {
    systemMessage = await renderTemplatedString(systemMessage, readFile, {});
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
    systemMessage,
    writeLog,
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
  const cls = LLMs.find((llm) => llm.providerName === providerName);

  if (!cls) {
    throw new Error(`Unknown LLM provider type "${providerName}"`);
  }

  return new cls(llmOptions);
}
