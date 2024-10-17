const Types = `
declare global {
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

  export type PromptTemplate =
    | string
    | ((
        history: ChatMessage[],
        otherData: Record<string, string>,
      ) => string | ChatMessage[]);

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

    engine?: string;
    apiVersion?: string;
    apiType?: string;
    region?: string;
    projectId?: string;

    complete(prompt: string, options?: LLMFullCompletionOptions): Promise<string>;

    streamComplete(
      prompt: string,
      options?: LLMFullCompletionOptions,
    ): AsyncGenerator<string, PromptLog>;

    streamFim(
      prefix: string,
      suffix: string,
      options?: LLMFullCompletionOptions,
    ): AsyncGenerator<string, PromptLog>;

    streamChat(
      messages: ChatMessage[],
      options?: LLMFullCompletionOptions,
    ): AsyncGenerator<ChatMessage, PromptLog>;

    chat(
      messages: ChatMessage[],
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
    title: string;
    displayTitle: string;
    description: string;
    renderInlineAs?: string;
    type: ContextProviderType;
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

  export interface ContextItem {
    content: string;
    name: string;
    description: string;
    editing?: boolean;
    editable?: boolean;
    icon?: string;
  }

  export interface ContextItemWithId {
    content: string;
    name: string;
    description: string;
    id: ContextItemId;
    editing?: boolean;
    editable?: boolean;
    icon?: string;
  }

  export interface InputModifiers {
    useCodebase: boolean;
    noContext: boolean;
  }

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

  export type ChatHistory = ChatHistoryItem[];

  // LLM

  export interface LLMFullCompletionOptions extends BaseCompletionOptions {
    log?: boolean;

    model?: string;
  }
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
    engine?: string;
    apiVersion?: string;
    apiType?: string;

    // AWS options
    profile?: string;
    modelArn?: string;

    // AWS and GCP Options
    region?: string;

    // GCP Options
    projectId?: string;
    capabilities?: ModelCapability;

    // IBM watsonx options
    watsonxUrl?: string;
    watsonxCreds?: string;
    watsonxProjectId?: string;
    watsonxStopToken?: string;
    watsonxApiVersion?: string;
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
      options: CompletionOptions,
      fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
    ) => AsyncGenerator<string>;
    streamChat?: (
      messages: ChatMessage[],
      options: CompletionOptions,
      fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
    ) => AsyncGenerator<string>;
    listModels?: (
      fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
    ) => Promise<string[]>;
  }

  /**
   * The LLM interface requires you to specify either \`streamCompletion\` or \`streamChat\` (or both).
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
    getDiff(includeUnstaged: boolean): Promise<string>;
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
    getCurrentFile(): Promise<string | undefined>;
    getPinnedFiles(): Promise<string[]>;
    getSearchResults(query: string): Promise<string>;
    subprocess(command: string): Promise<[string, string]>;
    getProblems(filepath?: string | undefined): Promise<Problem[]>;
    getBranch(dir: string): Promise<string>;
    getTags(artifactId: string): Promise<IndexTag[]>;
    getRepoName(dir: string): Promise<string | undefined>;
    errorPopup(message: string): Promise<void>;
    infoPopup(message: string): Promise<void>;

    getGitRootPath(dir: string): Promise<string | undefined>;
    listDir(dir: string): Promise<[string, FileType][]>;
    getLastModified(files: string[]): Promise<{ [path: string]: number }>;
    getGitHubAuthToken(): Promise<string | undefined>;

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
    | "greptile";

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
    | "nvidia";

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
    // Mistral
    | "codestral-latest"
    | "open-mistral-7b"
    | "open-mixtral-8x7b"
    | "open-mixtral-8x22b"
    | "mistral-small-latest"
    | "mistral-large-latest"
    | "mistral-7b"
    | "mistral-8x7b"
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
    // Other Open-source
    | "phi2"
    | "phind-codellama-34b"
    | "wizardcoder-7b"
    | "wizardcoder-13b"
    | "wizardcoder-34b"
    | "zephyr-7b"
    | "codeup-13b"
    | "deepseek-7b"
    | "deepseek-33b"
    | "neural-chat-7b"
    | "gemma-7b-it"
    | "gemma2-9b-it"
    // Anthropic
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
    // Mistral
    | "mistral-tiny"
    | "mistral-small"
    | "mistral-medium"
    // Tab autocomplete
    | "deepseek-1b"
    | "starcoder-1b"
    | "starcoder-3b"
    | "starcoder2-3b"
    | "stable-code-3b";

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
    keepAlive?: number;
    raw?: boolean;
    stream?: boolean;
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
    | "huggingface-tei"
    | "transformers.js"
    | "ollama"
    | "openai"
    | "cohere"
    | "free-trial"
    | "gemini"
    | "continue-proxy"
    | "deepinfra"
    | "voyage";

  export interface EmbedOptions {
    apiBase?: string;
    apiKey?: string;
    model?: string;
    engine?: string;
    apiType?: string;
    apiVersion?: string;
    requestOptions?: RequestOptions;
    maxChunkSize?: number;
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
    useCopyBuffer: boolean;
    useFileSuffix: boolean;
    maxPromptTokens: number;
    debounceDelay: number;
    maxSuffixPercentage: number;
    prefixPercentage: number;
    template?: string;
    multilineCompletions: "always" | "never" | "auto";
    slidingWindowPrefixPercentage: number;
    slidingWindowSize: number;
    maxSnippetPercentage: number;
    recentlyEditedSimilarityThreshold: number;
    useCache: boolean;
    onlyMyCode: boolean;
    useOtherFiles: boolean;
    useRecentlyEdited: boolean;
    recentLinePrefixMatchMinLength: number;
    disableInFiles?: string[];
    useImports?: boolean;
  }

  export interface ContinueUIConfig {
    codeBlockToolbarPosition?: "top" | "bottom";
    fontSize?: number;
    displayRawMarkdown?: boolean;
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
  }

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
     * If \`true\`, the result of the quick action will be sent to the chat panel.
     * If \`false\`, the streamed result will be inserted into the document.
     *
     * Defaults to \`false\`.
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
     * A CustomLLM requires you only to define an AsyncGenerator that calls the LLM and yields string updates. You can choose to define either \`streamCompletion\` or \`streamChat\` (or both).
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
     * A CustomContextProvider requires you only to define a title and getContextItems function. When you type '@title <query>', Continue will call \`getContextItems(query)\`.
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
  }

}

export {};
`;

export default Types;
