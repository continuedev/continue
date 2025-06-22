import { ChatMessage, CompletionOptions, LLMOptions, MessageContent, Tool, ToolCallDelta } from "../../index.js";
import { BaseLLM } from "../index.js";
import { AICoreClaudeProvider } from "./AICore/AICoreClaudeProvider.js";
import { AICoreGeneralProvider } from "./AICore/AICoreGeneralProvider.js";
const CAP_MESSAGE = `
  Instactions for SAP Cloud Application Programming Model (CAP):
    - DO:
      - After you createing the application run it!
      - Before you createing the application, using tools, mcp etc you need to give the user summry.
      - Summarize just the first time the user want to create an application.
      - Assume cds installed as global package.
      - Use the summery as information to build a prompt to the CAP MCP Server tools.
      - When CAP MCP Server tools passed successfully:
        1) setup the application directory as the git work directory.
        2) run git init.
        3) return answer to the user that we created application successfully and if he need more help.
  
    - DO NOT:
      - Dont summarize evry step.
      - Dont Create the application with out that the user Approve the application summry.
      - Dont use npx
    
    - Application Summry Instactions:
      - A high-level description of the application's purpose and main features. 
      - A simplified storyboard-style diagram showing key entities and their relationships (this can reflect or be derived from the data model). 
      - Example data models: define main entities and how data is structured and accessed. 
      - Recommended technology stack (Node.js with CAP, SAP Fiori/UI5 or suitable low-code alternatives, database). 
      - Project architecture outline (folder structure, main modules, and interactions).
      Keep the explanation concise, clear, and focused on system design. Do **not** generate implementation code or file scaffolding. Do **not** include a summary or closing paragraph.
`

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
        if(messages.length > 1){
            const content = messages[1].content;
            messages[1].content = `USER: ${content} SYSTEM: ${CAP_MESSAGE}`;
        }
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
