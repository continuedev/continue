export interface ILLM extends LLMOptions {
  get providerName(): ModelProvider;

  uniqueId: string;
  model: string;

  title?: string;
  systemMessage?: string;
  contextLength: number;
  completionOptions: CompletionOptions;
  requestOptions?: RequestOptions;
  promptTemplates?: Record<string, string>;
  templateMessages?: (messages: ChatMessage[]) => string;
  writeLog?: (str: string) => Promise<void>;
  llmRequestHook?: (model: string, prompt: string) => any;
  apiKey?: string;
  apiBase?: string;

  engine?: string;
  apiVersion?: string;
  apiType?: string;
  region?: string;
  projectId?: string;

  _fetch?: (input: any, init?: any) => Promise<any>;

  complete(prompt: string, options?: LLMFullCompletionOptions): Promise<string>;

  streamComplete(
    prompt: string,
    options?: LLMFullCompletionOptions
  ): AsyncGenerator<string>;

  streamChat(
    messages: ChatMessage[],
    options?: LLMFullCompletionOptions
  ): AsyncGenerator<ChatMessage>;

  chat(
    messages: ChatMessage[],
    options?: LLMFullCompletionOptions
  ): Promise<ChatMessage>;

  countTokens(text: string): number;
}

export interface ContextProviderDescription {
  title: string;
  displayTitle: string;
  description: string;
  dynamic: boolean;
  requiresQuery: boolean;
}

export interface CustomContextProvider {
  title: string;
  displayTitle?: string;
  description?: string;
  getContextItems(query: string): Promise<ContextItem[]>;
}

export interface IContextProvider {
  get description(): ContextProviderDescription;

  getContextItems(query: string): Promise<ContextItem[]>;
}

export interface PersistedSessionInfo {
  history: ChatHistory;
  title: string;
  workspaceDirectory: string;
  sessionId: string;
}

export interface SessionInfo {
  sessionId: string;
  title: string;
  dateCreated: string;
  workspaceDirectory: string;
}

export interface RangeInFile {
  filepath: string;
  range: Range;
}

export interface Range {
  start: Position;
  end: Position;
}
export interface Position {
  line: number;
  character: number;
}
export interface FileEdit {
  filepath: string;
  range: Range;
  replacement: string;
}

export interface ContinueError {
  title: string;
  message: string;
}

export interface CompletionOptions {
  model: string;

  maxTokens: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: string[];
}

export type ChatMessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface ContextItemId {
  providerTitle: string;
  itemId: string;
}

export interface ContextItem {
  content: string;
  name: string;
  description: string;
  editing?: boolean;
  editable?: boolean;
}

export interface ContextItemWithId {
  content: string;
  name: string;
  description: string;
  id: ContextItemId;
  editing?: boolean;
  editable?: boolean;
}

export interface ChatHistoryItem {
  message: ChatMessage;
  editorState?: any;
  contextItems: ContextItemWithId[];
  promptLogs?: [string, string][]; // [prompt, completion]
}

export type ChatHistory = ChatHistoryItem[];

// LLM

export interface LLMFullCompletionOptions {
  raw?: boolean;
  log?: boolean;

  model?: string;

  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: string[];
  maxTokens?: number;
}
export interface LLMOptions {
  model: string;

  title?: string;
  uniqueId?: string;
  systemMessage?: string;
  contextLength?: number;
  completionOptions?: CompletionOptions;
  requestOptions?: RequestOptions;
  template?: TemplateType;
  promptTemplates?: Record<string, string>;
  templateMessages?: (messages: ChatMessage[]) => string;
  writeLog?: (str: string) => Promise<void>;
  llmRequestHook?: (model: string, prompt: string) => any;
  apiKey?: string;
  apiBase?: string;

  // Azure options
  engine?: string;
  apiVersion?: string;
  apiType?: string;

  // GCP Options
  region?: string;
  projectId?: string;
}
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export interface CustomLLMWithOptionals {
  options?: LLMOptions;
  streamCompletion?: (
    prompt: string,
    options: CompletionOptions,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  ) => AsyncGenerator<string>;
  streamChat?: (
    messages: ChatMessage[],
    options: CompletionOptions,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  ) => AsyncGenerator<string>;
}

/**
 * The LLM interface requires you to specify either `streamCompletion` or `streamChat` (or both).
 */
export type CustomLLM = RequireAtLeastOne<
  CustomLLMWithOptionals,
  "streamCompletion" | "streamChat"
>;

// IDE

export interface DiffLine {
  type: "new" | "old" | "same";
  line: string;
}

export interface IDE {
  getSerializedConfig(): Promise<SerializedContinueConfig>;
  getConfigJsUrl(): Promise<string | undefined>;
  getDiff(): Promise<string>;
  getTerminalContents(): Promise<string>;
  listWorkspaceContents(directory?: string): Promise<string[]>;
  getWorkspaceDirs(): Promise<string[]>;
  writeFile(path: string, contents: string): Promise<void>;
  showVirtualFile(title: string, contents: string): Promise<void>;
  getContinueDir(): Promise<string>;
  openFile(path: string): Promise<void>;
  runCommand(command: string): Promise<void>;
  saveFile(filepath: string): Promise<void>;
  readFile(filepath: string): Promise<string>;
  showDiff(
    filepath: string,
    newContents: string,
    stepIndex: number
  ): Promise<void>;
  verticalDiffUpdate(
    filepath: string,
    startLine: number,
    endLine: number,
    diffLine: DiffLine
  ): Promise<void>;
  getOpenFiles(): Promise<string[]>;
}

// Slash Commands

export interface ContinueSDK {
  ide: IDE;
  llm: ILLM;
  addContextItem: (item: ContextItemWithId) => void;
  history: ChatMessage[];
  input: string;
  params?: any;
  contextItems: ContextItemWithId[];
}

export interface SlashCommand {
  name: string;
  description: string;
  params?: { [key: string]: any };
  run: (sdk: ContinueSDK) => AsyncGenerator<string | undefined>;

  // If true, this command will be run in NodeJs and have access to the filesystem and other Node-only APIs
  // You must make sure to dynamically import any Node-only dependencies in your command so that it doesn't break in the browser
  runInNodeJs?: boolean;
}

// Config

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
  | "tree"
  | "http";

type TemplateType =
  | "llama2"
  | "alpaca"
  | "zephyr"
  | "phind"
  | "anthropic"
  | "chatml"
  | "none"
  | "openchat"
  | "deepseek";

type ModelProvider =
  | "openai"
  | "openai-free-trial"
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
  | "llamafile"
  | "gemini"
  | "mistral"
  | "bedrock";

export type ModelName =
  // OpenAI
  | "gpt-3.5-turbo"
  | "gpt-3.5-turbo-16k"
  | "gpt-4"
  | "gpt-3.5-turbo-0613"
  | "gpt-4-32k"
  | "gpt-4-1106-preview"
  // Open Source
  | "mistral-7b"
  | "mistral-8x7b"
  | "llama2-7b"
  | "llama2-13b"
  | "codellama-7b"
  | "codellama-13b"
  | "codellama-34b"
  | "phind-codellama-34b"
  | "wizardcoder-7b"
  | "wizardcoder-13b"
  | "wizardcoder-34b"
  | "zephyr-7b"
  | "codeup-13b"
  | "deepseek-1b"
  | "deepseek-7b"
  | "deepseek-33b"
  // Anthropic
  | "claude-2"
  // Google PaLM
  | "chat-bison-001"
  // Gemini
  | "gemini-pro"
  // Mistral
  | "mistral-tiny"
  | "mistral-small"
  | "mistral-medium";

export interface RequestOptions {
  timeout?: number;
  verifySsl?: boolean;
  caBundlePath?: string | string[];
  proxy?: string;
  headers?: { [key: string]: string };
}

export interface StepWithParams {
  name: StepName;
  params: { [key: string]: any };
}

export interface ContextProviderWithParams {
  name: ContextProviderName;
  params: { [key: string]: any };
}

export interface SlashCommandDescription {
  name: string;
  description: string;
  step: StepName | string;
  params?: { [key: string]: any };
}

export interface CustomCommand {
  name: string;
  prompt: string;
  description: string;
}
export interface RetrievalSettings {
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
  minP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: string[];
  maxTokens: number;
}

export interface ModelDescription {
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
  promptTemplates?: { [key: string]: string };
}

export interface ModelRoles {
  default: string;
  chat?: string;
  edit?: string;
  summarize?: string;
}

export interface SerializedContinueConfig {
  disallowedSteps?: string[];
  allowAnonymousTelemetry?: boolean;
  models: ModelDescription[];
  systemMessage?: string;
  completionOptions?: BaseCompletionOptions;
  slashCommands?: SlashCommandDescription[];
  customCommands?: CustomCommand[];
  contextProviders?: ContextProviderWithParams[];
  retrievalSettings?: RetrievalSettings;
  disableIndexing?: boolean;
  userToken?: string;
}

export interface Config {
  /** If set to true, Continue will collect anonymous usage data to improve the product. If set to false, we will collect nothing. Read here to learn more: https://continue.dev/docs/telemetry */
  allowAnonymousTelemetry?: boolean;
  /** Each entry in this array will originally be a ModelDescription, the same object from your config.json, but you may add CustomLLMs.
   * A CustomLLM requires you only to define an AsyncGenerator that calls the LLM and yields string updates. You can choose to define either `streamCompletion` or `streamChat` (or both).
   * Continue will do the rest of the work to construct prompt templates, handle context items, prune context, etc.
   */
  models: (CustomLLM | ModelDescription)[];
  /** A system message to be followed by all of your models */
  systemMessage?: string;
  /** The default completion options for all models */
  completionOptions?: BaseCompletionOptions;
  /** The list of slash commands that will be available in the sidebar */
  slashCommands?: SlashCommand[];
  /** Each entry in this array will originally be a ContextProviderWithParams, the same object from your config.json, but you may add CustomContextProviders.
   * A CustomContextProvider requires you only to define a title and getContextItems function. When you type '@title <query>', Continue will call `getContextItems(query)`.
   */
  contextProviders?: (CustomContextProvider | ContextProviderWithParams)[];
  /** Settings related to the /codebase retrieval feature */
  retrievalSettings?: RetrievalSettings;
  /** If set to true, Continue will not index your codebase for retrieval */
  disableIndexing?: boolean;
  /** An optional token to identify a user. Not used by Continue unless you write custom coniguration that requires such a token */
  userToken?: string;
}

export interface ContinueConfig {
  allowAnonymousTelemetry?: boolean;
  models: ILLM[];
  systemMessage?: string;
  completionOptions?: BaseCompletionOptions;
  slashCommands?: SlashCommand[];
  contextProviders?: IContextProvider[];
  retrievalSettings?: RetrievalSettings;
  disableIndexing?: boolean;
  userToken?: string;
}
