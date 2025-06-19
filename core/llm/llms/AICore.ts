import { ChatMessage, CompletionOptions, LLMOptions, MessageContent, Tool, ToolCallDelta } from "../../index.js";
import { BaseLLM } from "../index.js";
import { AICoreClaudeProvider } from "./AICore/AICoreClaudeProvider.js";
import { AICoreGeneralProvider } from "./AICore/AICoreGeneralProvider.js";


export class AICore extends BaseLLM {
    private aICoreClaudeProvider?: AICoreClaudeProvider;
    private aICoreGeneralProvider?: AICoreGeneralProvider;
    private llmOptions: LLMOptions;
    static providerName = "aiCore";

    static defaultOptions: Partial<LLMOptions> = {
        model: "anthropic--claude-3.7-sonnet",
        contextLength: 128_000,
        completionOptions: {
            model: "anthropic--claude-3.7-sonnet",
            maxTokens: 4096,
        },
    };

    constructor(options: LLMOptions) {
        super(options);
        this.llmOptions = options
    }

    protected async *_streamComplete(
        prompt: string,
        signal: AbortSignal,
        options: CompletionOptions,
    ): AsyncGenerator<string> {
        const messages = [{ role: "user" as const, content: prompt }];
        for await (const update of this._streamChat(messages, signal, options)) {
            const content = update.content;
            if (Array.isArray(content)) {
                for (const chunk of content) {
                    if (chunk.type === "text") {
                        yield chunk.text;
                    }
                }
            }
            else {
                yield content
            }

        }
    }

    protected async *_streamChat(
        messages: ChatMessage[],
        signal: AbortSignal,
        options: CompletionOptions,
    ): AsyncGenerator<ChatMessage> {
        let provider: AICoreClaudeProvider | AICoreGeneralProvider;
        if (!options.model || options.model.includes("claude-3.7")) {
            if (!this.aICoreClaudeProvider) {
                this.aICoreClaudeProvider = new AICoreClaudeProvider(this.llmOptions)
            }
            provider = this.aICoreClaudeProvider
        }
        else {
            if (!this.aICoreGeneralProvider) {
                this.aICoreGeneralProvider = new AICoreGeneralProvider(this.llmOptions)
            }
            provider = this.aICoreGeneralProvider
        }
        for await (const message of provider._streamChat(messages, signal, options)) {
            yield message
        }
    }

}
