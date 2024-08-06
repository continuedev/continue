import Handlebars from "handlebars";
import { v4 as uuidv4 } from "uuid";
import {
  BaseCompletionOptions,
  IdeSettings,
  ILLM,
  LLMOptions,
  ModelDescription,
} from "../../index.js";
import { DEFAULT_MAX_TOKENS } from "../constants.js";
import { BaseLLM } from "../index.js";
import Anthropic from "./Anthropic.js";
import Bedrock from "./Bedrock.js";
import Cloudflare from "./Cloudflare.js";
import Cohere from "./Cohere.js";
import DeepInfra from "./DeepInfra.js";
import Deepseek from "./Deepseek.js";
import Fireworks from "./Fireworks.js";
import Flowise from "./Flowise.js";
import FreeTrial from "./FreeTrial.js";
import Gemini from "./Gemini.js";
import Groq from "./Groq.js";
import HuggingFaceInferenceAPI from "./HuggingFaceInferenceAPI.js";
import HuggingFaceTGI from "./HuggingFaceTGI.js";
import LMStudio from "./LMStudio.js";
import LlamaCpp from "./LlamaCpp.js";
import Llamafile from "./Llamafile.js";
import Mistral from "./Mistral.js";
import Msty from "./Msty.js";
import Azure from "./Azure.js";
import Ollama from "./Ollama.js";
import OpenAI from "./OpenAI.js";
import Replicate from "./Replicate.js";
import TextGenWebUI from "./TextGenWebUI.js";
import Together from "./Together.js";
import ContinueProxy from "./stubs/ContinueProxy.js";
import WatsonX from "./WatsonX.js";
import { renderTemplatedString } from "../../promptFiles/renderTemplatedString.js";

const LLMs = [
  Anthropic,
  Cohere,
  FreeTrial,
  Gemini,
  Llamafile,
  Ollama,
  Replicate,
  TextGenWebUI,
  Together,
  HuggingFaceTGI,
  HuggingFaceInferenceAPI,
  LlamaCpp,
  OpenAI,
  LMStudio,
  Mistral,
  Bedrock,
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
        cls.defaultOptions?.completionOptions?.maxTokens ??
        DEFAULT_MAX_TOKENS,
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
