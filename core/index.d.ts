import Parser from "web-tree-sitter";
import { GetGhTokenArgs } from "./protocol/ide";

declare global {
  interface Window {
    ide?: "vscode";
    windowId: string;
    serverUrl: string;
    vscMachineId: string;
    vscMediaUrl: string;
    fullColorTheme?: {
      rules?: {
        token?: string;
        foreground?: string;
      }[];
    };
    colorThemeName?: string;
    workspacePaths?: string[];
    postIntellijMessage?: (
      messageType: string,
      data: any,
      messageIde: string,
    ) => void;
  }
}

export interface ChunkWithoutID {
  content: string;
  startLine: number;
  endLine: number;
  signature?: string;
  otherMetadata?: { [key: string]: any };
}

export interface Chunk extends ChunkWithoutID {
  digest: string;
  filepath: string;
  index: number; // Index of the chunk in the document at filepath
}

export interface IndexingProgressUpdate {
  progress: number;
  desc: string;
  shouldClearIndexes?: boolean;
  status: "loading" | "indexing" | "done" | "failed" | "paused" | "disabled";
  debugInfo?: string;
}

// This is more or less a V2 of IndexingProgressUpdate
export interface IndexingStatus {
  id: string;
  type: "docs";
  progress: number;
  description: string;
  status:
    | "indexing"
    | "complete"
    | "paused"
    | "failed"
    | "aborted"
    | "deleted"
    | "pending";
  embeddingsProviderId: string;
  isReindexing?: boolean;
  debugInfo?: string;
  title: string;
  icon?: string;
  url?: string;
}

export type PromptTemplateFunction = (
  history: ChatMessage[],
  otherData: Record<string, string>,
) => string | ChatMessage[];

export type PromptTemplate = string | PromptTemplateFunction;

export interface ILLM extends LLMOptions {
  get providerName(): ModelProvider;

  uniqueId: string;
  model: string;

  title?: string;
  systemMessage?: string;
  contextLength: number;
  maxStopWords?: number;
  completionOptions: CompletionOptions;
  requestOptions?: RequestOptions;
  promptTemplates?: Record<string, PromptTemplate>;
  templateMessages?: (messages: ChatMessage[]) => string;
  writeLog?: (str: string) => Promise<void>;
  llmRequestHook?: (model: string, prompt: string) => any;
  apiKey?: string;
  apiBase?: string;
  cacheBehavior?: CacheBehavior;

  deployment?: string;
  apiVersion?: string;
  apiType?: string;
  region?: string;
  projectId?: string;

  complete(
    prompt: string,
    signal: AbortSignal,
    options?: LLMFullCompletionOptions,
  ): Promise<string>;

  streamComplete(
    prompt: string,
    signal: AbortSignal,
    options?: LLMFullCompletionOptions,
  ): AsyncGenerator<string, PromptLog>;

  streamFim(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options?: LLMFullCompletionOptions,
  ): AsyncGenerator<string, PromptLog>;

  streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options?: LLMFullCompletionOptions,
  ): AsyncGenerator<ChatMessage, PromptLog>;

  chat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options?: LLMFullCompletionOptions,
  ): Promise<ChatMessage>;

  countTokens(text: string): number;

  supportsImages(): boolean;

  supportsCompletions(): boolean;

  supportsPrefill(): boolean;

  supportsFim(): boolean;

  listModels(): Promise<string[]>;

  renderPromptTemplate(
    template: PromptTemplate,
    history: ChatMessage[],
    otherData: Record<string, string>,
    canPutWordsInModelsMouth?: boolean,
  ): string | ChatMessage[];
}

export type ContextProviderType = "normal" | "query" | "submenu";

export interface ContextProviderDescription {
  title: ContextProviderName;
  displayTitle: string;
  description: string;
  renderInlineAs?: string;
  type: ContextProviderType;
  dependsOnIndexing?: boolean;
}

export type FetchFunction = (url: string | URL, init?: any) => Promise<any>;

export interface ContextProviderExtras {
  config: ContinueConfig;
  fullInput: string;
  embeddingsProvider: EmbeddingsProvider;
  reranker: Reranker | undefined;
  llm: ILLM;
  ide: IDE;
  selectedCode: RangeInFile[];
  fetch: FetchFunction;
}

export interface LoadSubmenuItemsArgs {
  config: ContinueConfig;
  ide: IDE;
  fetch: FetchFunction;
}

export interface CustomContextProvider {
  title: string;
  displayTitle?: string;
  description?: string;
  renderInlineAs?: string;
  type?: ContextProviderType;
  getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]>;
  loadSubmenuItems?: (
    args: LoadSubmenuItemsArgs,
  ) => Promise<ContextSubmenuItem[]>;
}

export interface ContextSubmenuItem {
  id: string;
  title: string;
  description: string;
  icon?: string;
  metadata?: any;
}

export interface SiteIndexingConfig {
  title: string;
  startUrl: string;
  rootUrl?: string;
  maxDepth?: number;
  faviconUrl?: string;
}

export interface SiteIndexingConfig {
  startUrl: string;
  rootUrl?: string;
  title: string;
  maxDepth?: number;
}

export interface IContextProvider {
  get description(): ContextProviderDescription;

  getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]>;

  loadSubmenuItems(args: LoadSubmenuItemsArgs): Promise<ContextSubmenuItem[]>;
}

export interface Checkpoint {
  [filepath: string]: string;
}

export interface Session {
  sessionId: string;
  title: string;
  workspaceDirectory: string;
  history: ChatHistoryItem[];
  checkpoints?: Checkpoint[];
}

export interface SessionMetadata {
  sessionId: string;
  title: string;
  dateCreated: string;
  workspaceDirectory: string;
}

export interface RangeInFile {
  filepath: string;
  range: Range;
}

export interface Location {
  filepath: string;
  position: Position;
}

export interface FileWithContents {
  filepath: string;
  contents: string;
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

export interface CompletionOptions extends BaseCompletionOptions {
  model: string;
}

export type ChatMessageRole = "user" | "assistant" | "system";

export interface MessagePart {
  type: "text" | "imageUrl";
  text?: string;
  imageUrl?: { url: string };
}

export type MessageContent = string | MessagePart[];

export interface ChatMessage {
  role: ChatMessageRole;
  content: MessageContent;
}

export interface ContextItemId {
  providerTitle: string;
  itemId: string;
}

export type ContextItemUriTypes = "file" | "url";

export interface ContextItemUri {
  type: ContextItemUriTypes;
  value: string;
}

export interface ContextItem {
  content: string;
  name: string;
  description: string;
  editing?: boolean;
  editable?: boolean;
  icon?: string;
  uri?: ContextItemUri;
}

export interface ContextItemWithId extends ContextItem {
  id: ContextItemId;
}

export interface InputModifiers {
  useCodebase: boolean;
  noContext: boolean;
}

export interface SymbolWithRange extends RangeInFile {
  name: string;
  type: Parser.SyntaxNode["type"];
}

export type FileSymbolMap = Record<string, SymbolWithRange[]>;

export interface PromptLog {
  modelTitle: string;
  completionOptions: CompletionOptions;
  prompt: string;
  completion: string;
}
export interface ChatHistoryItem {
  message: ChatMessage;
  editorState?: any;
  modifiers?: InputModifiers;
  contextItems: ContextItemWithId[];
  promptLogs?: PromptLog[];
}

// LLM

export interface LLMFullCompletionOptions extends BaseCompletionOptions {
  log?: boolean;

  model?: string;
}

export type ToastType = "info" | "error" | "warning";

export interface LLMOptions {
  model: string;

  title?: string;
  uniqueId?: string;
  systemMessage?: string;
  contextLength?: number;
  maxStopWords?: number;
  completionOptions?: CompletionOptions;
  requestOptions?: RequestOptions;
  template?: TemplateType;
  promptTemplates?: Record<string, PromptTemplate>;
  templateMessages?: (messages: ChatMessage[]) => string;
  writeLog?: (str: string) => Promise<void>;
  llmRequestHook?: (model: string, prompt: string) => any;
  apiKey?: string;
  aiGatewaySlug?: string;
  apiBase?: string;
  cacheBehavior?: CacheBehavior;

  useLegacyCompletionsEndpoint?: boolean;

  // Cloudflare options
  accountId?: string;

  // Azure options
  deployment?: string;
  apiVersion?: string;
  apiType?: string;

  // AWS options
  profile?: string;
  modelArn?: string;

  // AWS and GCP Options
  region?: string;

  // GCP Options
  capabilities?: ModelCapability;

  // GCP and Watsonx Options
  projectId?: string;

  // IBM watsonx Options
  deploymentId?: string;
}
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export interface CustomLLMWithOptionals {
  options: LLMOptions;
  streamCompletion?: (
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  ) => AsyncGenerator<string>;
  streamChat?: (
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  ) => AsyncGenerator<string>;
  listModels?: (
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  ) => Promise<string[]>;
}

/**
 * The LLM interface requires you to specify either `streamCompletion` or `streamChat` (or both).
 */
export type CustomLLM = RequireAtLeastOne<
  CustomLLMWithOptionals,
  "streamCompletion" | "streamChat"
>;

// IDE

export type DiffLineType = "new" | "old" | "same";

export interface DiffLine {
  type: DiffLineType;
  line: string;
}

export class Problem {
  filepath: string;
  range: Range;
  message: string;
}

export class Thread {
  name: string;
  id: number;
}

export type IdeType = "vscode" | "jetbrains";
export interface IdeInfo {
  ideType: IdeType;
  name: string;
  version: string;
  remoteName: string;
  extensionVersion: string;
}

export interface BranchAndDir {
  branch: string;
  directory: string;
}

export interface IndexTag extends BranchAndDir {
  artifactId: string;
}

export enum FileType {
  Unkown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export interface IdeSettings {
  remoteConfigServerUrl: string | undefined;
  remoteConfigSyncPeriod: number;
  userToken: string;
  enableControlServerBeta: boolean;
  pauseCodebaseIndexOnStart: boolean;
  enableDebugLogs: boolean;
}

export interface IDE {
  getIdeInfo(): Promise<IdeInfo>;
  getIdeSettings(): Promise<IdeSettings>;
  getDiff(includeUnstaged: boolean): Promise<string[]>;
  getClipboardContent(): Promise<{ text: string; copiedAt: string }>;
  isTelemetryEnabled(): Promise<boolean>;
  getUniqueId(): Promise<string>;
  getTerminalContents(): Promise<string>;
  getDebugLocals(threadIndex: number): Promise<string>;
  getTopLevelCallStackSources(
    threadIndex: number,
    stackDepth: number,
  ): Promise<string[]>;
  getAvailableThreads(): Promise<Thread[]>;
  listFolders(): Promise<string[]>;
  getWorkspaceDirs(): Promise<string[]>;
  getWorkspaceConfigs(): Promise<ContinueRcJson[]>;
  fileExists(filepath: string): Promise<boolean>;
  writeFile(path: string, contents: string): Promise<void>;
  showVirtualFile(title: string, contents: string): Promise<void>;
  getContinueDir(): Promise<string>;
  openFile(path: string): Promise<void>;
  openUrl(url: string): Promise<void>;
  runCommand(command: string): Promise<void>;
  saveFile(filepath: string): Promise<void>;
  readFile(filepath: string): Promise<string>;
  readRangeInFile(filepath: string, range: Range): Promise<string>;
  showLines(
    filepath: string,
    startLine: number,
    endLine: number,
  ): Promise<void>;
  showDiff(
    filepath: string,
    newContents: string,
    stepIndex: number,
  ): Promise<void>;
  getOpenFiles(): Promise<string[]>;
  getCurrentFile(): Promise<
    | undefined
    | {
        isUntitled: boolean;
        path: string;
        contents: string;
      }
  >;
  getPinnedFiles(): Promise<string[]>;
  getSearchResults(query: string): Promise<string>;
  subprocess(command: string, cwd?: string): Promise<[string, string]>;
  getProblems(filepath?: string | undefined): Promise<Problem[]>;
  getBranch(dir: string): Promise<string>;
  getTags(artifactId: string): Promise<IndexTag[]>;
  getRepoName(dir: string): Promise<string | undefined>;
  showToast(
    type: ToastType,
    message: string,
    ...otherParams: any[]
  ): Promise<any>;
  getGitRootPath(dir: string): Promise<string | undefined>;
  listDir(dir: string): Promise<[string, FileType][]>;
  getLastModified(files: string[]): Promise<{ [path: string]: number }>;
  getGitHubAuthToken(args: GetGhTokenArgs): Promise<string | undefined>;

  // LSP
  gotoDefinition(location: Location): Promise<RangeInFile[]>;

  // Callbacks
  onDidChangeActiveTextEditor(callback: (filepath: string) => void): void;
  pathSep(): Promise<string>;
}

// Slash Commands

export interface ContinueSDK {
  ide: IDE;
  llm: ILLM;
  addContextItem: (item: ContextItemWithId) => void;
  history: ChatMessage[];
  input: string;
  params?: { [key: string]: any } | undefined;
  contextItems: ContextItemWithId[];
  selectedCode: RangeInFile[];
  config: ContinueConfig;
  fetch: FetchFunction;
}

export interface SlashCommand {
  name: string;
  description: string;
  params?: { [key: string]: any };
  run: (sdk: ContinueSDK) => AsyncGenerator<string | undefined>;
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
  | "debugger"
  | "open"
  | "google"
  | "search"
  | "tree"
  | "http"
  | "codebase"
  | "problems"
  | "folder"
  | "jira"
  | "postgres"
  | "database"
  | "code"
  | "docs"
  | "gitlab-mr"
  | "os"
  | "currentFile"
  | "greptile"
  | "outline"
  | "continue-proxy"
  | "highlights"
  | "file"
  | "issue"
  | "repo-map"
  | "url"
  | string;

type TemplateType =
  | "llama2"
  | "alpaca"
  | "zephyr"
  | "phi2"
  | "phind"
  | "anthropic"
  | "chatml"
  | "none"
  | "openchat"
  | "deepseek"
  | "xwin-coder"
  | "neural-chat"
  | "codellama-70b"
  | "llava"
  | "gemma"
  | "granite"
  | "llama3";

type ModelProvider =
  | "openai"
  | "free-trial"
  | "anthropic"
  | "cohere"
  | "together"
  | "ollama"
  | "huggingface-tgi"
  | "huggingface-inference-api"
  | "kindo"
  | "llama.cpp"
  | "replicate"
  | "text-gen-webui"
  | "lmstudio"
  | "llamafile"
  | "gemini"
  | "mistral"
  | "bedrock"
  | "bedrockimport"
  | "sagemaker"
  | "deepinfra"
  | "flowise"
  | "groq"
  | "continue-proxy"
  | "fireworks"
  | "custom"
  | "cloudflare"
  | "deepseek"
  | "azure"
  | "openai-aiohttp"
  | "msty"
  | "watsonx"
  | "openrouter"
  | "sambanova"
  | "nvidia"
  | "vllm"
  | "mock"
  | "cerebras"
  | "askSage"
  | "vertexai"
  | "nebius"
  | "xAI"
  | "moonshot"
  | "siliconflow";

export type ModelName =
  | "AUTODETECT"
  // OpenAI
  | "gpt-3.5-turbo"
  | "gpt-3.5-turbo-16k"
  | "gpt-4"
  | "gpt-3.5-turbo-0613"
  | "gpt-4-32k"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4-turbo"
  | "gpt-4-turbo-preview"
  | "gpt-4-vision-preview"
  | "o1-preview"
  | "o1-mini"
  // Mistral
  | "codestral-latest"
  | "open-mistral-7b"
  | "open-mixtral-8x7b"
  | "open-mixtral-8x22b"
  | "mistral-small-latest"
  | "mistral-large-latest"
  | "mistral-7b"
  | "mistral-8x7b"
  | "mistral-8x22b"
  | "mistral-tiny"
  | "mistral-small"
  | "mistral-medium"
  | "mistral-embed"
  | "mistral-nemo"
  // Llama 2
  | "llama2-7b"
  | "llama2-13b"
  | "llama2-70b"
  | "codellama-7b"
  | "codellama-13b"
  | "codellama-34b"
  | "codellama-70b"
  // Llama 3
  | "llama3-8b"
  | "llama3-70b"
  // Llama 3.1
  | "llama3.1-8b"
  | "llama3.1-70b"
  | "llama3.1-405b"
  // Llama 3.2
  | "llama3.2-1b"
  | "llama3.2-3b"
  | "llama3.2-11b"
  | "llama3.2-90b"
  // xAI
  | "grok-beta"
  // Other Open-source
  | "phi2"
  | "phi-3-mini"
  | "phi-3-medium"
  | "phind-codellama-34b"
  | "wizardcoder-7b"
  | "wizardcoder-13b"
  | "wizardcoder-34b"
  | "zephyr-7b"
  | "codeup-13b"
  | "deepseek-7b"
  | "deepseek-33b"
  | "deepseek-2-lite"
  | "neural-chat-7b"
  | "gemma-7b-it"
  | "gemma2-2b-it"
  | "gemma2-9b-it"
  | "olmo-7b"
  | "qwen-coder2.5-7b"
  // Anthropic
  | "claude-3-5-sonnet-latest"
  | "claude-3-5-sonnet-20240620"
  | "claude-3-opus-20240229"
  | "claude-3-sonnet-20240229"
  | "claude-3-haiku-20240307"
  | "claude-2.1"
  | "claude-2"
  // Cohere
  | "command-r"
  | "command-r-plus"
  // Gemini
  | "gemini-pro"
  | "gemini-1.5-pro-latest"
  | "gemini-1.5-pro"
  | "gemini-1.5-flash-latest"
  | "gemini-1.5-flash"
  // Tab autocomplete
  | "deepseek-1b"
  | "starcoder-1b"
  | "starcoder-3b"
  | "starcoder2-3b"
  | "stable-code-3b"
  // Moonshot
  | "moonshot-v1-8k"
  | "moonshot-v1-32k"
  | "moonshot-v1-128k";

export interface RequestOptions {
  timeout?: number;
  verifySsl?: boolean;
  caBundlePath?: string | string[];
  proxy?: string;
  headers?: { [key: string]: string };
  extraBodyProperties?: { [key: string]: any };
  noProxy?: string[];
  clientCertificate?: ClientCertificateOptions;
}

export interface CacheBehavior {
  cacheSystemMessage?: boolean;
  cacheConversation?: boolean;
}

export interface ClientCertificateOptions {
  cert: string;
  key: string;
  passphrase?: string;
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
  params?: { [key: string]: any };
}

export interface CustomCommand {
  name: string;
  prompt: string;
  description: string;
}

interface Prediction {
  type: "content";
  content:
    | string
    | {
        type: "text";
        text: string;
      }[];
}

interface BaseCompletionOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  mirostat?: number;
  stop?: string[];
  maxTokens?: number;
  numThreads?: number;
  useMmap?: boolean;
  keepAlive?: number;
  raw?: boolean;
  stream?: boolean;
  prediction?: Prediction;
}

export interface ModelCapability {
  uploadImage?: boolean;
}

export interface ModelDescription {
  title: string;
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  apiBase?: string;
  contextLength?: number;
  maxStopWords?: number;
  template?: TemplateType;
  completionOptions?: BaseCompletionOptions;
  systemMessage?: string;
  requestOptions?: RequestOptions;
  promptTemplates?: { [key: string]: string };
  capabilities?: ModelCapability;
  cacheBehavior?: CacheBehavior;
}

export type EmbeddingsProviderName =
  | "sagemaker"
  | "bedrock"
  | "huggingface-tei"
  | "transformers.js"
  | "ollama"
  | "openai"
  | "cohere"
  | "lmstudio"
  | "free-trial"
  | "gemini"
  | "continue-proxy"
  | "deepinfra"
  | "nvidia"
  | "voyage"
  | "mistral"
  | "nebius"
  | "vertexai"
  | "watsonx"
  | "siliconflow";

export interface EmbedOptions {
  apiBase?: string;
  apiKey?: string;
  model?: string;
  deployment?: string;
  apiType?: string;
  apiVersion?: string;
  requestOptions?: RequestOptions;
  maxChunkSize?: number;
  maxBatchSize?: number;
  // AWS options
  profile?: string;

  // AWS and GCP Options
  region?: string;

  // GCP and Watsonx Options
  projectId?: string;
}

export interface EmbeddingsProviderDescription extends EmbedOptions {
  provider: EmbeddingsProviderName;
}

export interface EmbeddingsProvider {
  id: string;
  providerName: EmbeddingsProviderName;
  maxChunkSize: number;
  embed(chunks: string[]): Promise<number[][]>;
}

export type RerankerName =
  | "cohere"
  | "voyage"
  | "llm"
  | "free-trial"
  | "huggingface-tei"
  | "continue-proxy";

export interface RerankerDescription {
  name: RerankerName;
  params?: { [key: string]: any };
}

export interface Reranker {
  name: string;
  rerank(query: string, chunks: Chunk[]): Promise<number[]>;
}

export interface TabAutocompleteOptions {
  disable: boolean;
  useFileSuffix: boolean;
  maxPromptTokens: number;
  debounceDelay: number;
  maxSuffixPercentage: number;
  prefixPercentage: number;
  transform?: boolean;
  template?: string;
  multilineCompletions: "always" | "never" | "auto";
  slidingWindowPrefixPercentage: number;
  slidingWindowSize: number;
  useCache: boolean;
  onlyMyCode: boolean;
  useRecentlyEdited: boolean;
  disableInFiles?: string[];
  useImports?: boolean;
  showWhateverWeHaveAtXMs?: number;
}

export interface ContinueUIConfig {
  codeBlockToolbarPosition?: "top" | "bottom";
  fontSize?: number;
  displayRawMarkdown?: boolean;
  showChatScrollbar?: boolean;
  getChatTitles?: boolean;
}

interface ContextMenuConfig {
  comment?: string;
  docstring?: string;
  fix?: string;
  optimize?: string;
  fixGrammar?: string;
}

interface ModelRoles {
  inlineEdit?: string;
  applyCodeBlock?: string;
  repoMapFileSelection?: string;
}

export type EditStatus =
  | "not-started"
  | "streaming"
  | "accepting"
  | "accepting:full-diff"
  | "done";

export type ApplyStateStatus =
  | "streaming" // Changes are being applied to the file
  | "done" // All changes have been applied, awaiting user to accept/reject
  | "closed"; // All changes have been applied. Note that for new files, we immediately set the status to "closed"

export interface ApplyState {
  streamId: string;
  status?: ApplyStateStatus;
  numDiffs?: number;
  filepath?: string;
  fileContent?: string;
}

export interface RangeInFileWithContents {
  filepath: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  contents: string;
}

export type CodeToEdit = RangeInFileWithContents | FileWithContents;

/**
 * Represents the configuration for a quick action in the Code Lens.
 * Quick actions are custom commands that can be added to function and class declarations.
 */
interface QuickActionConfig {
  /**
   * The title of the quick action that will display in the Code Lens.
   */
  title: string;

  /**
   * The prompt that will be sent to the model when the quick action is invoked,
   * with the function or class body concatenated.
   */
  prompt: string;

  /**
   * If `true`, the result of the quick action will be sent to the chat panel.
   * If `false`, the streamed result will be inserted into the document.
   *
   * Defaults to `false`.
   */
  sendToChat: boolean;
}

export type DefaultContextProvider = ContextProviderWithParams & {
  query?: string;
};

interface ExperimentalConfig {
  contextMenuPrompts?: ContextMenuConfig;
  modelRoles?: ModelRoles;
  defaultContext?: DefaultContextProvider[];
  promptPath?: string;

  /**
   * Quick actions are a way to add custom commands to the Code Lens of
   * function and class declarations.
   */
  quickActions?: QuickActionConfig[];

  /**
   * Automatically read LLM chat responses aloud using system TTS models
   */
  readResponseTTS?: boolean;

  /**
   * If set to true, we will attempt to pull down and install an instance of Chromium
   * that is compatible with the current version of Puppeteer.
   * This is needed to crawl a large number of documentation sites that are dynamically rendered.
   */
  useChromiumForDocsCrawling?: boolean;
}

interface AnalyticsConfig {
  type: string;
  url?: string;
  clientKey?: string;
}

// config.json
export interface SerializedContinueConfig {
  env?: string[];
  allowAnonymousTelemetry?: boolean;
  models: ModelDescription[];
  systemMessage?: string;
  completionOptions?: BaseCompletionOptions;
  requestOptions?: RequestOptions;
  slashCommands?: SlashCommandDescription[];
  customCommands?: CustomCommand[];
  contextProviders?: ContextProviderWithParams[];
  disableIndexing?: boolean;
  disableSessionTitles?: boolean;
  userToken?: string;
  embeddingsProvider?: EmbeddingsProviderDescription;
  tabAutocompleteModel?: ModelDescription | ModelDescription[];
  tabAutocompleteOptions?: Partial<TabAutocompleteOptions>;
  ui?: ContinueUIConfig;
  reranker?: RerankerDescription;
  experimental?: ExperimentalConfig;
  analytics?: AnalyticsConfig;
  docs?: SiteIndexingConfig[];
}

export type ConfigMergeType = "merge" | "overwrite";

export type ContinueRcJson = Partial<SerializedContinueConfig> & {
  mergeBehavior: ConfigMergeType;
};

// config.ts - give users simplified interfaces
export interface Config {
  /** If set to true, Continue will collect anonymous usage data to improve the product. If set to false, we will collect nothing. Read here to learn more: https://docs.continue.dev/telemetry */
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
  /** Request options that will be applied to all models and context providers */
  requestOptions?: RequestOptions;
  /** The list of slash commands that will be available in the sidebar */
  slashCommands?: SlashCommand[];
  /** Each entry in this array will originally be a ContextProviderWithParams, the same object from your config.json, but you may add CustomContextProviders.
   * A CustomContextProvider requires you only to define a title and getContextItems function. When you type '@title <query>', Continue will call `getContextItems(query)`.
   */
  contextProviders?: (CustomContextProvider | ContextProviderWithParams)[];
  /** If set to true, Continue will not index your codebase for retrieval */
  disableIndexing?: boolean;
  /** If set to true, Continue will not make extra requests to the LLM to generate a summary title of each session. */
  disableSessionTitles?: boolean;
  /** An optional token to identify a user. Not used by Continue unless you write custom coniguration that requires such a token */
  userToken?: string;
  /** The provider used to calculate embeddings. If left empty, Continue will use transformers.js to calculate the embeddings with all-MiniLM-L6-v2 */
  embeddingsProvider?: EmbeddingsProviderDescription | EmbeddingsProvider;
  /** The model that Continue will use for tab autocompletions. */
  tabAutocompleteModel?:
    | CustomLLM
    | ModelDescription
    | (CustomLLM | ModelDescription)[];
  /** Options for tab autocomplete */
  tabAutocompleteOptions?: Partial<TabAutocompleteOptions>;
  /** UI styles customization */
  ui?: ContinueUIConfig;
  /** Options for the reranker */
  reranker?: RerankerDescription | Reranker;
  /** Experimental configuration */
  experimental?: ExperimentalConfig;
  /** Analytics configuration */
  analytics?: AnalyticsConfig;
}

// in the actual Continue source code
export interface ContinueConfig {
  allowAnonymousTelemetry?: boolean;
  models: ILLM[];
  systemMessage?: string;
  completionOptions?: BaseCompletionOptions;
  requestOptions?: RequestOptions;
  slashCommands?: SlashCommand[];
  contextProviders?: IContextProvider[];
  disableSessionTitles?: boolean;
  disableIndexing?: boolean;
  userToken?: string;
  embeddingsProvider: EmbeddingsProvider;
  tabAutocompleteModels?: ILLM[];
  tabAutocompleteOptions?: Partial<TabAutocompleteOptions>;
  ui?: ContinueUIConfig;
  reranker?: Reranker;
  experimental?: ExperimentalConfig;
  analytics?: AnalyticsConfig;
  docs?: SiteIndexingConfig[];
}

export interface BrowserSerializedContinueConfig {
  allowAnonymousTelemetry?: boolean;
  models: ModelDescription[];
  systemMessage?: string;
  completionOptions?: BaseCompletionOptions;
  requestOptions?: RequestOptions;
  slashCommands?: SlashCommandDescription[];
  contextProviders?: ContextProviderDescription[];
  disableIndexing?: boolean;
  disableSessionTitles?: boolean;
  userToken?: string;
  embeddingsProvider?: string;
  ui?: ContinueUIConfig;
  reranker?: RerankerDescription;
  experimental?: ExperimentalConfig;
  analytics?: AnalyticsConfig;
  docs?: SiteIndexingConfig[];
}

// DOCS SUGGESTIONS AND PACKAGE INFO
export interface FilePathAndName {
  path: string;
  name: string;
}

export interface PackageFilePathAndName extends FilePathAndName {
  packageRegistry: string; // e.g. npm, pypi
}

export type ParsedPackageInfo = {
  name: string;
  packageFile: PackageFilePathAndName;
  language: string;
  version: string;
};

export type PackageDetails = {
  docsLink?: string;
  docsLinkWarning?: string;
  title?: string;
  description?: string;
  repo?: string;
  license?: string;
};

export type PackageDetailsSuccess = PackageDetails & {
  docsLink: string;
};

export type PackageDocsResult = {
  packageInfo: ParsedPackageInfo;
} & (
  | { error: string; details?: never }
  | { details: PackageDetailsSuccess; error?: never }
);
