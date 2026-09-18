import Handlebars from "handlebars";
import {
  BaseCompletionOptions,
  IdeSettings,
  ILLM,
  ILLMLogger,
  JSONModelDescription,
  LLMOptions,
} from "../..";
import { renderTemplatedString } from "../../util/handlebars/renderTemplatedString";
import { BaseLLM } from "../index";
import VercelAIGateway from "./VercelAIGateway";

export const LLMClasses = [VercelAIGateway];

export function assertGatewayProvider(provider: string) {
  if (provider !== VercelAIGateway.providerName) {
    throw new Error(
      `Provider "${provider}" is disabled. This extension uses Vercel AI Gateway exclusively. Set provider: vercel-ai-gateway, use a publisher/model ID, and supply a Gateway API key.`,
    );
  }
}

export async function llmFromDescription(
  desc: JSONModelDescription,
  readFile: (filepath: string) => Promise<string>,
  getUriFromPath: (path: string) => Promise<string | undefined>,
  uniqueId: string,
  ideSettings: IdeSettings,
  llmLogger: ILLMLogger,
  completionOptions?: BaseCompletionOptions,
): Promise<BaseLLM | undefined> {
  assertGatewayProvider(desc.provider);
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
    // baseChatSystemMessage = DEFAULT_CHAT_SYSTEM_MESSAGE;
    // baseChatSystemMessage += "\n\n";
    baseChatSystemMessage = await renderTemplatedString(
      Handlebars,
      desc.systemMessage,
      {},
      [],
      readFile,
      getUriFromPath,
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
    basePlanSystemMessage: baseChatSystemMessage,
    baseAgentSystemMessage: baseChatSystemMessage,
    logger: llmLogger,
    uniqueId,
  };

  return new cls(options);
}

export function llmFromProviderAndOptions(
  providerName: string,
  llmOptions: LLMOptions,
): ILLM {
  assertGatewayProvider(providerName);
  const cls = LLMClasses.find((llm) => llm.providerName === providerName);

  if (!cls) {
    throw new Error(`Unknown LLM provider type "${providerName}"`);
  }

  return new cls(llmOptions);
}
