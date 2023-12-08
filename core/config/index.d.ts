/*

These are the types for the JSON config file, config.json.

**/

type StepName =
  | "AnswerQuestionChroma"
  | "GenerateShellCommandStep"
  | "EditHighlightedCodeStep"
  | "ShareSessionStep"
  | "CommentCodeStep"
  | "ClearHistoryStep"
  | "StackOverflowStep"
  | "OpenConfigStep"
  | "GenerateShellCommandStep"
  | "DraftIssueStep";

type ContextProviderName =
  | "diff"
  | "github"
  | "terminal"
  | "open"
  | "google"
  | "search"
  | "url"
  | "tree";

type TemplateType =
  | "llama2"
  | "alpaca"
  | "zephyr"
  | "phind"
  | "anthropic"
  | "chatml"
  | "deepseek";

type ModelProvider =
  | "openai"
  | "openai-free-trial"
  | "openai-aiohttp"
  | "anthropic"
  | "together"
  | "ollama"
  | "huggingface-tgi"
  | "huggingface-inference-api"
  | "llama.cpp"
  | "replicate"
  | "text-gen-webui"
  | "google-palm"
  | "lmstudio"
  | "llamafile";

interface RequestOptions {
  timeout?: number;
  verifySsl?: boolean;
  caBundlePath: string;
  proxy?: string;
  headers?: Record<string, string>;
}

interface StepWithParams {
  name: StepName;
  params: { [key: string]: any };
}

interface ContextProviderWithParams {
  name: ContextProviderName;
  params: { [key: string]: any };
}

interface SlashCommand {
  name: string;
  description: string;
  step: StepName | string;
  params?: { [key: string]: any };
}

interface CustomCommand {
  name: string;
  prompt: string;
  description: string;
}
interface RetrievalSettings {
  nRetrieve?: number;
  nFinal?: number;
  useReranking: boolean;
  rerankGroupSize: number;
  ignoreFiles: string[];
  openaiApiKey?: string;
  apiBase?: string;
  apiType?: string;
  apiVersion?: string;
  organizationId?: string;
}

interface BaseCompletionOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: string[];
  maxTokens: number;
}

interface ModelDescription {
  title: string;
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  apiBase?: string;
  contextLength?: number;
  template?: TemplateType;
  completionOptions?: BaseCompletionOptions;
  systemMessage?: string;
  requestOptions?: RequestOptions;
}

interface ModelRoles {
  default: string;
  chat?: string;
  edit?: string;
  summarize?: string;
}

interface SerializedContinueConfig {
  disallowedSteps?: string[];
  allowAnonymousTelemetry?: boolean;
  models: ModelDescription[];
  modelRoles: ModelRoles;
  systemMessage?: string;
  completionOptions?: BaseCompletionOptions;
  slashCommands?: SlashCommand[];
  customCommands?: CustomCommand[];
  contextProviders?: ContextProviderWithParams[];
}
export {
  StepName,
  ContextProviderName,
  TemplateType,
  ModelProvider,
  RequestOptions,
  StepWithParams,
  ContextProviderWithParams,
  SlashCommand,
  CustomCommand,
  RetrievalSettings,
  BaseCompletionOptions,
  ModelDescription,
  ModelRoles,
  SerializedContinueConfig,
};
