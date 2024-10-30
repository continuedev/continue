interface BaseCompletionOptions {
    stream?: boolean; // Whether to stream the LLM response. Only respected by the 'anthropic' provider. Defaults to true.
    temperature?: number; // The temperature of the completion, controlling randomness.
    topP?: number; // The top-p value, which controls the cumulative probability for nucleus sampling.
    topK?: number; // The top-k value, which restricts sampling to the top k tokens.
    presencePenalty?: number; // The presence penalty, influencing the likelihood of generating similar tokens.
    frequencePenalty?: number; // The frequency penalty, affecting the likelihood of repeating tokens.
    mirostat?: number; // Mirostat sampling option to control perplexity (0 = disabled, 1 = Mirostat, 2 = Mirostat 2.0). Only supported by Ollama, LM Studio, and llama.cpp providers.
    stop?: string[]; // Array of stop tokens that wil dl terminate the completion.
    maxTokens?: number; // The maximum number of tokens to generate. Defaults to 600.
    numThreads?: number; // The number of threads used in the generation process. Only available for the Ollama provider.
    keepAlive?: number; // The number of seconds to keep the model loaded after the last request. Defaults to 1800 seconds (30 minutes).
}

interface RequestOptions {
    timeout?: number; // Set the timeout for each request to the LLM. Default is 7200 seconds.
    verifySsl?: boolean; // Whether to verify SSL certificates for requests.
    caBundlePath?: string | string[]; // Path to a custom CA bundle for HTTP requests.
    proxy?: string; // Proxy URL to use for HTTP requests.
    headers?: Record<string, string>; // Headers for HTTP requests.
    extraBodyProperties?: Record<string, unknown>; // Properties to merge with the HTTP request body.
    noProxy?: string[]; // List of hostnames that should bypass the specified proxy.
    clientCertificate?: {
        cert: string; // Path to the client certificate file.
        key: string; // Path to the client certificate key file.
        passphrase?: string; // Passphrase for the client certificate key file, if required.
    }; // Client certificate for HTTP requests.
}

interface ModelDescription {
    title: string; // Title for the model.
    provider:
    | "openai"
    | "free-trial"
    | "etc" // Provider of the model, used to determine model type and interaction method.
    model: string; // Model name, used for prompt template auto-detection.
    apiKey?: string; // API key for providers like OpenAI, Anthropic, Cohere, etc.
    apiBase?: string; // Base URL of the LLM API.
    region?: string; // Region where the model is hosted.
    profile?: string; // AWS security profile.
    modelArn?: string; // AWS ARN for the imported model.
    contextLength?: number; // Maximum context length of the LLM in tokens.
    maxStopWords?: number; // Maximum stop words accepted by the API.
    template?:
    | "llama2"
    | "alpaca"
    | "zephyr"
    | "phi2"
    | "phind"
    | "anthropic"
    | "chatml"
    | "none"
    | "deepseek"
    | "openchat"
    | "xwin-coder"
    | "neural-chat"
    | "codellama-70b"
    | "llava"
    | "gemma"
    | "llama3"; // Chat template for message formatting, with auto-detection option.
    promptTemplates?: Record<string, string>; // Mapping of prompt template names to prompt strings.
    completionOptions?: BaseCompletionOptions; // Options for the completion endpoint.
    systemMessage?: string; // System message that will precede responses from the LLM.
    requestOptions?: RequestOptions; // HTTP request options for the LLM.
    apiType?: "openai" | "azure"; // API type (OpenAI or Azure).
    apiVersion?: string; // Azure OpenAI API version (e.g., 2023-07-01-preview).
    engine?: string; // Azure OpenAI engine.
    capabilities?: {
        uploadImage?: boolean; // Indicates if the model can upload images.
    };
}

type ContextProviderName = "diff" | "terminal" | "debugger" | "open" | "google" | "search" | "http" | "codebase" | "problems" | "folder" | "issue" | "docs" | "tree" | "highlights" | "outline" | "postgres" | "code" | "currentFile" | "url" | "database" | "os" | "repo-map" | "greptile" | "web" | string

interface ContextProviderWithParams {
    name: ContextProviderName
    params?: Record<string, any>; // Parameters for the context provider. DEFAULT {}
}

interface SerializedContinueConfig {

    completionOptions?: BaseCompletionOptions; // Default completion options, overridden by model-specific options.
    requestOptions?: RequestOptions; // Default HTTP request options for models and context providers.
    models?: ModelDescription[]; // Model configurations, defaulting to GPT-4 (trial) with free-trial provider.

    systemMessage?: string; // System message preceding all LLM responses.

    // TAB AUTOCOMPLETE 

    tabAutocompleteModel?: ModelDescription | ModelDescription[]; // Model for tab autocompletion, defaulting to Ollama instance.

    tabAutocompleteOptions?: {
        disable?: boolean; // If true, disables tab autocomplete. Default is false.
        useCopyBuffer?: boolean; // If true, includes the copy buffer in prompt.
        useFileSuffix?: boolean; // If true, includes file suffix in prompt.
        maxPromptTokens?: number; // Max tokens for prompt.
        debounceDelay?: number; // Delay in ms before triggering autocomplete.
        maxSuffixPercentage?: number; // Max percentage of prompt for suffix.
        prefixPercentage?: number; // Percentage of input for prefix.
        template?: string; // Template string for autocomplete, using Mustache templating.
        multilineCompletions?: "always" | "never" | "auto"; // Controls multiline completions.
        useCache?: boolean; // If true, caches completions.
        onlyMyCode?: boolean; // If true, only includes code within repository.
        useOtherFiles?: boolean; // If true, includes snippets from other files. Default is true.
        disableInFiles?: string[]; // Glob patterns for files where autocomplete is disabled.
    };

    // EMBEDDINGS
    disableIndexing?: boolean; // If true, prevents codebase indexing, mainly for debugging.
    embeddingsProvider?: {
        provider: "huggingface-tei" | "transformers.js" | "ollama" | "openai" | "cohere" | "free-trial" | "gemini" | "voyage" | "nvidia" | "bedrock" | "sagemaker" | "vertex"; // Embeddings provider for codebase embeddings.
        model?: string; // Model name for embeddings.
        apiKey?: string; // API key for the provider.
        apiBase?: string; // Base URL for API requests.
        requestOptions?: RequestOptions; // Request options for embeddings provider.
        maxChunkSize?: number; // Max tokens per document chunk, min 128.
        maxBatchSize?: number; // Max chunks per request, min 1.
        region?: string; // Region where the model is hosted.
        profile?: string; // AWS security profile.
    };


    // RERANKING

    reranker?: {
        name: "cohere" | "voyage" | "llm" | "free-trial" | "huggingface-tei"; // Reranker name.
        params?: Record<string, any>; // Additional parameters for reranking.
    };

    // COMMANDS
    slashCommands?: {
        name: "issue" | "share" | "cmd" | "edit" | "comment" | "http" | "commit" | "review" | string; // Slash command name.
        description: string; // Description of the command.
        step?: string; // Deprecated. Used for built-in commands; set name for pre-configured options.
        params?: Record<string, any>; // Additional parameters for the command.
    }; // Custom slash commands for sidebar actions.
    customCommands?: {
        name: string; // Name of the custom command.
        prompt: string; // Prompt for the command.
        description: string; // Description of the command.
    }[]; // Custom commands for prompt shortcuts, with name, description, and prompt.

    // CONTEXT_PROVIDERS
    contextProviders?: ContextProviderWithParams[]; // List of context providers for LLM context.

    // DOCS
    docs?: {
        title: string; // Title of the documentation site.
        startUrl: string; // Starting URL for indexing.
        rootUrl?: string; // Root URL of the site.
        maxDepth?: number; // Maximum depth for crawling.
        favicon?: string; // URL for site favicon, defaults to /favicon.ico from startUrl.
    }[]; // List of documentation sites to index.

    // UI
    disableSessionTitles?: boolean; // If true, prevents generating session summary titles.

    ui?: {
        codeBlockToolbarPosition?: "top" | "bottom"; // Toolbar position in code blocks, default is "top".
        fontSize?: number; // Font size for UI elements.
        displayRawMarkdown?: boolean; // If true, displays raw markdown in output.
        showChatScrollbar?: boolean; // If true, displays scrollbar in chat window.
    };

    // ANALYTICS
    allowAnonymousTelemetry?: boolean; // If true, anonymous telemetry is collected. Default is true.

    analytics?: {
        provider: "posthog" | "logstash"; // Analytics provider.
        url?: string; // URL for analytics data.
        clientKey?: string; // Client key for analytics.
    };

    // AUTH
    userToken?: string; // Optional token to identify the user.

    // EXPERIMENTAL
    experimental?: {
        defaultContext?: (ContextProviderWithParams & { query?: string })[]; // Default context for the LLM.
        modelRoles?: {
            inlineEdit?: string; // Model title for inline edits.
            applyCodeBlock?: string; // Model title for applying code blocks.
            repoMapFileSelection?: string; // Model title for repo map selections.
        };
        readResponseTTS?: boolean; // If true, reads LLM responses aloud with TTS. Default is true.
        promptPath?: string; // Path for prompt configuration.
        quickActions?: {
            title: string; // Display title for the quick action.
            prompt: string; // Prompt for quick action.
            sendToChat?: boolean; // If true, sends result to chat; else inserts in document. Default is false.
        }[]; // Array of custom quick actions for code lens.

        contextMenuPrompts?: {
            comment?: string; // Prompt for commenting code.
            docstring?: string; // Prompt for adding docstrings.
            fix?: string; // Prompt for fixing code.
            optimize?: string; // Prompt for optimizing code.
            fixGrammar?: string; // Prompt for fixing grammar or spelling.
        };
    };
}
