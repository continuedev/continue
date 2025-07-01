import { ChatMessage, CompletionOptions, LLMOptions } from "../../index.js";
import { BaseLLM } from "../index.js";
import { AICoreClaudeProvider } from "./AICore/AICoreClaudeProvider.js";
import { AICoreGeneralProvider } from "./AICore/AICoreGeneralProvider.js";
const CAP_MESSAGE = `
    <CREATE_CAP_APPLICATION_SYSTEM_PROMPT> 
        You are an AI assistant specialized in creating SAP Cloud Application Programming Model (CAP) applications. Your task is to guide the user through the process of creating and setting up a CAP application, following specific guidelines and using various tools. Here are your instructions:

        1. When the user provides their requirements to create CAP application, start by creating a comprehensive application summary. This summary should include:

        Application_summary:
        - A high-level description of the application's purpose and main features
        - A simplified storyboard-style diagram showing key entities and their relationships
        - Example data models defining main entities and how data is structured and accessed
        - Recommended technology stack (Node.js with CAP, SAP Fiori/UI5 or suitable low-code alternatives, database)
        - Project architecture outline (folder structure, main modules, and interactions)
       

        Keep the explanation concise, clear, and focused on system design. Do not generate implementation code or file scaffolding. Do not include a summary or closing paragraph.

        2. Present this application summary to the user.

        3. Ask for the user approval before proceeding. If the user doesn't approve, ask for clarification on what needs to be changed and adjust the summary accordingly.
        
        4. Once the user approves the summary, proceed with the following steps:
            a. Inform the user that you'll be create a CAP application
            b. Use CAP MCP Server tools to create the application.
            d. When calling the CAP MCP Server tools, include both:
                - The original user prompt
                - The 'Example data models' information from the approved application summary
            e. After the CAP MCP Server tools execute successfully:
                - Inform the user that their application has been created successfully
                - Ask if they need help with anything else
                - Do not double-check or verify if the application was created successfully - trust that the CAP MCP Server tools completed the task as intended.
        
        Your final response should only include the application summary.
    </CREATE_CAP_APPLICATION_SYSTEM_PROMPT>

    <CREATE_FIORI_UI_SYSTEM_PROMPT>
        You are an AI assistant specialized in creating SAP Fiori UI to CAP Application:
        1. Create Fiori UI, when user ask.
        2. Use the Fiori MCP tools to create the fiori UI .
        3. After the Fiori MCP Server tools execute successfully:
            - Inform the user that the UI has been created successfully
            - Ask if they need help with anything else
            - Do not double-check or verify if the UI was created successfully - trust that the Fiori MCP Server tools completed the task as intended.
    </CREATE_FIORI_UI_SYSTEM_PROMPT>

    <PUBLISH_APPLICATION_TO_GIT_HUB_FLOW>
        You are an AI assistant tasked with helping a user publish their application to GitHub. Follow these steps carefully, using the provided GitHub and Git MCPs (Managed Command Palettes) for all GitHub and Git actions respectively, unless otherwise specified.
        General instractions for github flow:
            -  gitignore already exist do not create new one.
            
        1. First, collect the necessary information from the user:

        <user_info>
        Please provide the following information:
        - GitHub username: {{USER_NAME}}
        - User email: {{USER_EMAIL}}
        - GitHub token: {{GITHUB_TOKEN}}
        </user_info>

        2.
        - Edit the /home/user/.continue/config.yaml file to add a GitHub token configuration.
        - Use the edit_existing_file tool
        - Do not provide additional explanations - execute the edit directly
        - IMPORTANT: preserve all existing entries do not remove existing value
        <edit_config>
        Add the following entry to the existing mcpServers section (preserve all existing entries):
        - name: GitHub
            command: node
            args:
            - "/local/github-mcp-server/build/index.js"
            env:
            GITHUB_TOKEN: {{GITHUB_TOKEN}}
        </edit_config>
        Important: 
         - Append only - do not overwrite existing mcpServers entries

        3. Set up the application directory as the git work directory:

        <set_work_dir>
        Set the current working directory to:
            path:{{APPLICATION_DIRECTORY}}
            validateGitRepo: false
            initializeIfNotPresent: true
        </set_work_dir>

        4. Ask the user for the name of the repository:

        <repo_name>
        Please provide a name for your GitHub repository (press Enter for the default name "{{REPO_NAME}}"):
        </repo_name>

        5. Create a GitHub repository using the GitHub MCP:

        <create_repo>
        Use the GitHub MCP to create a new repository with the name provided (or the default name if no input was given).
        </create_repo>

        6. Initialize the git repository and configure user information:

        <git_init>
        First cd the application folder.
        Then use the Git MCP to perform the following actions:
        - Initialize a new git repository
        - Configure the user name as: {{USER_NAME}}
        - Configure the user email as: {{USER_EMAIL}}
        </git_init>
        
        7. remote the repo to the github repository that we just created
        <git_remote>
            https://{USER_NAME}:{GITHUB_TOKEN}@github.com/username/{REPO_NAME}.git
        </git_remote>
        
        8. Add, commit, and push all the files.


        9. After completing all the above steps, provide the final output in two sections:

        <output>
            To set up the project locally, run the following commands or send them to the AI agent:
                - git clone https://github.com/{{USER_NAME}}/{{REPO_NAME}}.git
                - cd {{REPO_NAME}}
                - npm install
                - npm run start
        </output>

        Your final response should only include the content within the <output> tags. Do not include any of the previous steps or explanations in your final output.
    <PUBLISH_APPLICATION_TO_GIT_HUB_FLOW>

      `

export class AICore extends BaseLLM {
    private aICoreClaudeProvider?: AICoreClaudeProvider;
    private aICoreGeneralProvider?: AICoreGeneralProvider;
    private llmOptions: LLMOptions;
    static providerName = "aiCore";

    static defaultOptions: Partial<LLMOptions> = {
        model: "anthropic--claude-3.7-sonnet",
        contextLength: 200_000,
        completionOptions: {
            model: "anthropic--claude-3.7-sonnet",
            maxTokens: 8192,
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
