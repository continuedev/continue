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
  n_retrieve?: number;
  n_final?: number;
  use_reranking: boolean;
  rerank_group_size: number;
  ignore_files: string[];
  openai_api_key?: string;
  api_base?: string;
  api_type?: string;
  api_version?: string;
  organization_id?: string;
}

interface BaseCompletionOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
  max_tokens: number;
}

interface ModelDescription {
  title: string;
  provider: ModelProvider;
  model: string;
  api_key?: string;
  api_base?: string;
  context_length: number;
  template?: TemplateType;
  completion_options: BaseCompletionOptions;
  system_message?: string;
  request_options: RequestOptions;
}

interface ModelRoles {
  default: string;
  chat?: string;
  edit?: string;
  summarize?: string;
}

interface SerializedContinueConfig {
  disallowed_steps?: string[];
  allow_anonymous_telemetry?: boolean;
  models: ModelDescription[];
  model_roles: ModelRoles;
  system_message?: string;
  completion_options: BaseCompletionOptions;
  slash_commands?: SlashCommand[];
  custom_commands?: CustomCommand[];
}
