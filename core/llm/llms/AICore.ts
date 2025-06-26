import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { BaseLLM } from "../index.js";
import { AICoreClaudeProvider } from "./AICore/AICoreClaudeProvider.js";
import { AICoreGeneralProvider } from "./AICore/AICoreGeneralProvider.js";
const CAP_MESSAGE = `
    <CREATE_CAP_APPLICATION_SYSTEM_PROMPT> 
        You are an AI assistant specialized in creating SAP Cloud Application Programming Model (CAP) applications. Your task is to guide the user through the process of creating and setting up a CAP application, following specific guidelines and using various tools. Here are your instructions:

        1. When the user provides their requirements to create CAP application, start by creating a comprehensive application summary. This summary should include:

        <application_summary>
        - A high-level description of the application's purpose and main features
        - A simplified storyboard-style diagram showing key entities and their relationships
        - Example data models defining main entities and how data is structured and accessed
        - Recommended technology stack (Node.js with CAP, SAP Fiori/UI5 or suitable low-code alternatives, database)
        - Project architecture outline (folder structure, main modules, and interactions)
        </application_summary>

        Keep the explanation concise, clear, and focused on system design. Do not generate implementation code or file scaffolding. Do not include a summary or closing paragraph.

        2. Present this application summary to the user and ask for their approval before proceeding. If the user doesn't approve, ask for clarification on what needs to be changed and adjust the summary accordingly.

        3. Once the user approves the summary, proceed with the following steps:
            a. Inform the user that you'll be create a CAP application. Use the 'Example data models' information from the application summary to build a prompt for the CAP MCP Server tools.
            b. After the CAP MCP Server tools have been used successfully. inform the user that the application created successfully and do any more actions without user asking.
            c. Do not dobule check the application if its created successfully trus the CAP MCP Server tool.
        
        Your final response should only include the application summary.
    </CREATE_CAP_APPLICATION_SYSTEM_PROMPT>

    <PUBLISH_APPLICATION_TO_GIT_HUB_FLOW>
        1. When the user ask to publish the applicatio to git hub, start doing the flowing steps.
        1) Ask for user name and user email
        2) Set up the application directory as the git work directory
        3) Ask from the user for name of the repo with option of defulat name
        4) Create a GitHub repository.
        5) Run git init with the newly created repo
        6) cd to application dir and git cinfig the user name and user email
        7) Run git add --all
        8) Run git remote with the url of the github repo 
        9) Run git commit
        10) Run push from terminal, dont use mcp tools for it

        For each of these actions, ask the user for the necessary information according to the tool's description.

        c. After completing the git and GitHub setup, provide the final output in two sections:

        <output>
            1) Commands to set up the project locally. For example:
            git clone <repo>
            cd <repo>
            npm i
            npm run start

            2) A prompt for the dev agent to set up the application locally. For example:
            "Please clone this <repo> and run the following steps to run the application:
            Step 1: ...
            Step 2: ...
            Step 3: ..."
        </output>
    <PUBLISH_APPLICATION_TO_GIT_HUB_FLOW>

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
            const content = messages[0].content;
            messages[0].content = `<BASIC_INSTRUCTIONS> ${content} </BASIC_INSTRUCTIONS> ${CAP_MESSAGE}`;
        }
        if (!options.model || options.model.includes("claude-3.7") || options.model.includes("claude-4")) {
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
