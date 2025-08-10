import { ChatMessage as AICoreChatMessage, ChatMessages as AICoreChatMessages, ChatCompletionTool, MessageToolCall, MessageToolCalls, OrchestrationClient, OrchestrationModuleConfig, OrchestrationStream, Prompt, TextContent, ToolCallChunk } from "@sap-ai-sdk/orchestration";
import fs from "fs";
import os from "os";
import path from "path";
import { ChatMessage, CompletionOptions, LLMOptions, MessageContent, Tool, ToolCallDelta } from "../../index.js";
import { BaseLLM } from "../index.js";
import { registerDestination } from '@sap-cloud-sdk/connectivity';
import { devspace } from "@sap/bas-sdk";
import { CAP_MESSAGE } from "./BASSystemPrompts.bas.js"

const AI_CORE_CREDS_FILENAME = "ai-core-creds.json";

export class AICore extends BaseLLM {
    static providerName = "aiCore";
    private llmOptions: LLMOptions;
    static defaultOptions: Partial<LLMOptions> = {
        model: "anthropic--claude-3.7-sonnet",
        contextLength: 200_000,
        completionOptions: {
            model: "anthropic--claude-3.7-sonnet",
            maxTokens: 8192,
        },
    };
    // Cache to indicate whether destination for LLM proxy has been registered
    private destinationBASLLMPromise;

    constructor(options: LLMOptions) {
        super(options);
        this.llmOptions = options;

        if (devspace.isBuild()) {
            this.destinationBASLLMPromise = registerDestination(
                { name: 'bas-llm', url: `${process.env["H2O_URL"]}/llm/v2` },
            );
        }
        // Only in Non BAS environments it may be possible to search for local json file. Otherwise it uses the BAS LLM Proxy.
        // Used for local development or testing purposes but do not fail if it doesn't exist.
        else if (!process.env["H2O_URL"]) {
            this.setupAiCore();
        }

    }

    private convertTools(tools?: Tool[]): ChatCompletionTool[] {
        if (!tools) {
            return []
        }
        return tools.map((tool) => {
            return {
                type: "function",
                function: {
                    "name": sanitizeToolName(tool.function.name),
                    "description": tool.function.description,
                    "parameters": tool.function.parameters,
                    "strict": tool.function.strict,
                }
            }

        })
    }

    private convertContentMessage(contents: MessageContent): string | TextContent[] {
        if (typeof contents === "string") {
            return contents;
        }
        return contents.filter((content) => content.type === "text").map((content) => {
            return {
                type: content.type,
                "text": content.text
            }
        })
    }

    private convertMessage(chatMessage: ChatMessage): AICoreChatMessage {
        const content = this.convertContentMessage(chatMessage.content)
        switch (chatMessage.role) {
            case "assistant":
                if (chatMessage.toolCalls) {
                    let toolCalls = this.convertToolCalls(chatMessage.toolCalls)
                    if (toolCalls.length >= 1) {
                        toolCalls = [toolCalls[0]];
                    }
                    return {
                        role: chatMessage.role,
                        content: "",
                        tool_calls: toolCalls
                    }
                }
                return {
                    role: chatMessage.role,
                    content: content,
                }
            case "tool":
                return {
                    role: "tool",
                    tool_call_id: chatMessage.toolCallId,
                    content: content,
                }
            case "system":
                return {
                    role: chatMessage.role,
                    content: content
                }
            case "user":
                return {
                    role: chatMessage.role,
                    content: content
                }

            case "thinking":
                return {
                    role: "system",
                    content: content
                }
        }

    }

    private convertToolCalls(toolCalls: ToolCallDelta[]): MessageToolCalls {
        const messageToolCalls = toolCalls.map((toolCallDelta) => {
            const toolFunction = toolCallDelta.function;
            if (!toolCallDelta.id || !toolFunction || !toolFunction.arguments || !toolFunction.name) {
                return undefined
            }
            const messageToolCall: MessageToolCall = {
                type: "function",
                id: toolCallDelta.id,
                function: { name: toolFunction.name, arguments: toolFunction.arguments }

            }
            return messageToolCall
        }).filter((messageToolCall) => messageToolCall !== undefined)
        return messageToolCalls;
    }

    private convertMessages(messages: ChatMessage[]): AICoreChatMessages {
        return messages.map((message) => this.convertMessage(message))
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

        // Inject system prompt message
        // The first message is always the system prompt. The messages must be greater than 1 since it must include system prompt and at least one uiser prompt.
        if (messages.length > 1) {
            const content = messages[0].content;
            messages[0].content = `<BASIC_INSTRUCTIONS> ${content} </BASIC_INSTRUCTIONS> ${CAP_MESSAGE}`;
        }

        // Wait until the destination is registered.
        await this.destinationBASLLMPromise;
        const tools = this.convertTools(options.tools);
        const allAiCoreMessages = this.convertMessages(messages)
        const messagesHistory = allAiCoreMessages.slice(0, -1); // All items except last
        const aiCoreMessages = [allAiCoreMessages[allAiCoreMessages.length - 1]]; // Last item in array

        const aiCorePrompt: Prompt = {
            messages: aiCoreMessages,
            messagesHistory: messagesHistory
        }

        const config: OrchestrationModuleConfig = {
            llm: {
                model_name: options.model,
                model_params: {
                    max_tokens: options.maxTokens,
                }
            },
            templating: {
                tools: tools,
            }
        }

        // Chat Completion

        // Relevant docs:
        // https://sap.github.io/ai-sdk/docs/js/orchestration/chat-completion#custom-destination
        // https://sap.github.io/cloud-sdk/docs/js/features/connectivity/destinations#register-destination 
        const orchestrationClient = new OrchestrationClient(config, undefined, {
            destinationName: 'bas-llm'
        });

        let response;
        try {
            response = await orchestrationClient.chatCompletion(aiCorePrompt);
        }
        catch (e) {
            throw e;
        }

        const toolsCallsAiCore = response.getToolCalls();
        const toolCalls: ToolCallDelta[] = (!toolsCallsAiCore) ? [] : this.parseToolsResponse(toolsCallsAiCore);

        const content = response.getContent();
        if (content) {
            const assistantMessage: ChatMessage = {
                role: "assistant",
                content: content,
                toolCalls: []
            };
            yield assistantMessage;
        }

        if (toolCalls?.length > 0) {
            // Yield the assistant message with tool calls
            const assistantMessage: ChatMessage = {
                role: "assistant",
                content: "",
                toolCalls: toolCalls
            };
            yield assistantMessage;
        }

        // Streaming - opened issue as it stream doesn't work with tool calling on certain models (claude): https://github.com/SAP/ai-sdk-js/issues/942 
        // try {
        //     let response = await orchestrationClient.stream(aiCorePrompt)
        //     for await (const chunk of response.stream) {
        //         const content = chunk.getDeltaContent();
        //         const deltaToolCalls = chunk.getDeltaToolCalls();
        //         console.log(deltaToolCalls);
        //         if (content) {
        //             const assistantMessage: ChatMessage = {
        //                 role: "assistant",
        //                 content: content,
        //                 toolCalls: []
        //             };
        //             yield assistantMessage;
        //         }
        //     }
        //     const toolsCallsAiCore = response.getToolCalls();
        //     if (toolsCallsAiCore && toolsCallsAiCore.length > 0) {
        //         const toolCalls: ToolCallDelta[] = this.parseToolsResponse(toolsCallsAiCore)
        //         const assistantMessage: ChatMessage = {
        //             role: "assistant",
        //             content: "",
        //             toolCalls: toolCalls
        //         };
        //         yield assistantMessage;
        //     }
        // }
        // catch (e) {
        //     throw e;
        // }

    }

    parseToolsResponse(toolsCallsAiCore: MessageToolCalls): ToolCallDelta[] {
        return toolsCallsAiCore.map((tool) => {
            return {
                id: tool.id,
                type: tool.type,
                function: {
                    name: tool.function.name,
                    arguments: tool.function.arguments
                }
            };
        });
    }

    loadAiCoreCredentials(): string | undefined {
        const credsFilePath = path.join(os.homedir(), AI_CORE_CREDS_FILENAME);

        try {
            if (!fs.existsSync(credsFilePath)) {
                return undefined;
            }

            const fileContents = fs.readFileSync(credsFilePath, "utf-8");
            const parsed = JSON.parse(fileContents)

            // Check and report missing credentials
            const missingCredentials = []
            if (!parsed.clientid) {
                missingCredentials.push("clientid")
            }
            if (!parsed.clientsecret) {
                missingCredentials.push("clientsecret")
            }
            if (!parsed.url) {
                missingCredentials.push("url")
            }
            if (!parsed.serviceurls) {
                missingCredentials.push("serviceurls")
            } else if (!parsed.serviceurls.AI_API_URL) {
                missingCredentials.push("serviceurls.AI_API_URL")
            }

            if (missingCredentials.length > 0) {
                throw new Error(`Credentials file is missing required properties: ${missingCredentials.join(", ")}`)
            }

            return JSON.stringify(parsed)
        } catch (e) {
            throw new Error(`Failed to parse AI Core credentials file. Error: ${e}`);
        }
    }

    setupAiCore(): void {
        let creds: string | undefined

        try {
            creds = this.loadAiCoreCredentials();
            process.env["AICORE_SERVICE_KEY"] = creds;
        } catch (err) {
            // Only log the error and proceed without setting the environment variable
            console.error(`Failed to load AI Core credentials: ${err}`);
        }

    }

}

/**
 * Adheres to the AI Core tool name requirements:
 * https://github.com/SAP/ai-sdk-js/blob/main/packages/orchestration/src/client/api/schema/function-object.ts#L15-L20
 * @param name 
 * @returns 
 * @returns 
 */
export function sanitizeToolName(name: string): string {
    // Replace any character not in [a-zA-Z0-9-_] with "-"
    let sanitized = name.replace(/[^a-zA-Z0-9-_]/g, "-");
    // Remove duplicate dashes/underscores, and trim
    sanitized = sanitized.replace(/[-_]{2,}/g, "-");
    // Remove starting/trailing dashes/underscores
    sanitized = sanitized.replace(/^[-_]+|[-_]+$/g, "");
    // Ensure max length 64
    if (sanitized.length > 64) {
        sanitized = sanitized.substring(0, 64);
    }
    // Fallback if empty 
    if (sanitized.length === 0) sanitized = "tool";
    return sanitized;
}