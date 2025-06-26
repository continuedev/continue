import fs from "fs";
import os from "os";
import path from "path";
import { ChatMessage, CompletionOptions, LLMOptions } from "../../../index.js";
import { BaseLLM } from "../../index.js";
import { stripImages } from "../../../util/messageContent.js";
import { ContentBlock, Message, ToolConfiguration } from "@aws-sdk/client-bedrock-runtime";
import { getSecureID } from "../../utils/getSecureID.js";
import SAPClaudeClient, { SAPClaudeClientOptions } from "./SAPClaudeClient.js";
import { sanitizeToolName } from "./AICoreUtils.js";

const AI_CORE_CREDS_FILENAME = "ai-core-creds.json"

interface ToolUseState {
    toolUseId: string;
    name: string;
    input: string;
}

export class AICoreClaudeProvider extends BaseLLM {
    private creds?: SAPClaudeClientOptions;
    static providerName = "aiCore";
    static defaultOptions: Partial<LLMOptions> = {
        model: "anthropic--claude-3.7-sonnet",
        contextLength: 128_000,
        completionOptions: {
            model: "anthropic--claude-3.7-sonnet",
            maxTokens: 4096,
        },
    };
    private _currentToolResponse: Partial<ToolUseState> | null = null;

    constructor(options: LLMOptions) {
        super(options);
        this.setupAiCore()
    }



    /**
     * Generates the input payload for the Bedrock Converse API
     * @param messages - Array of chat messages
     * @param options - Completion options
     * @returns Formatted input payload for the API
     */
    private _generateConverseInput(
        messages: ChatMessage[],
        options: CompletionOptions,
    ): any {
        const systemMessage = stripImages(
            messages.find((m) => m.role === "system")?.content ?? "",
        );
        const convertedMessages = this._convertMessages(messages);

        const shouldCacheSystemMessage =
            (!!systemMessage && this.cacheBehavior?.cacheSystemMessage) ||
            this.completionOptions.promptCaching;
        const enablePromptCaching =
            shouldCacheSystemMessage ||
            this.cacheBehavior?.cacheConversation ||
            this.completionOptions.promptCaching;
        const shouldCacheToolsConfig = this.completionOptions.promptCaching;



        const supportsTools = true;

        let toolConfig =
            supportsTools && options.tools
                ? ({
                    tools: options.tools.map((tool) => ({
                        toolSpec: {
                            name: sanitizeToolName(tool.function.name),
                            description: tool.function.description,
                            inputSchema: {
                                json: tool.function.parameters,
                            },
                        },
                    })),
                } as ToolConfiguration)
                : undefined;

        if (toolConfig?.tools && shouldCacheToolsConfig) {
            toolConfig.tools.push({ cachePoint: { type: "default" } });
        }

        if (toolConfig)
            return {
                toolConfig: toolConfig,
                system: systemMessage
                    ? shouldCacheSystemMessage
                        ? [{ text: systemMessage }, { cachePoint: { type: "default" } }]
                        : [{ text: systemMessage }]
                    : undefined,
                messages: convertedMessages,
                inferenceConfig: {
                    maxTokens: 4096,
                    temperature: 0,

                },
            };
        else
            return {
                messages: convertedMessages,
                system: systemMessage
                    ? shouldCacheSystemMessage
                        ? [{ text: systemMessage }, { cachePoint: { type: "default" } }]
                        : [{ text: systemMessage }]
                    : undefined,
                inferenceConfig: {
                    maxTokens: 8192,
                    temperature: 0,

                },
            };
    }
    private _convertMessages(messages: ChatMessage[]): any[] {
        const filteredmessages = messages.filter(
            (m) => m.role !== "system" && !!m.content,
        );
        const lastTwoUserMsgIndices = filteredmessages
            .map((msg, index) => (msg.role === "user" ? index : -1))
            .filter((index) => index !== -1)
            .slice(-2);

        const converted = filteredmessages
            .map((message, filteredMsgIdx) => {
                // Add cache_control parameter to the last two user messages
                // The second-to-last because it retrieves potentially already cached contents,
                // The last one because we want it cached for later retrieval.
                // See: https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
                const addCaching =
                    this.cacheBehavior?.cacheConversation &&
                    lastTwoUserMsgIndices.includes(filteredMsgIdx);

                try {
                    return this._convertMessage(message, addCaching);
                } catch (error) {
                    console.error(`Failed to convert message: ${error}`);
                    return null;
                }
            })
            .filter(Boolean);

        return converted;
    }

    private _convertMessage(
        message: ChatMessage,
        addCaching: boolean = false,
    ): Message | null {
        // Handle system messages explicitly
        if (message.role === "system") {
            return null;
        }

        const cachePoint = addCaching
            ? { cachePoint: { type: "default" } }
            : undefined;

        // Tool response handling
        if (message.role === "tool") {
            return {
                role: "user",
                content: [
                    {
                        toolResult: {
                            toolUseId: message.toolCallId,
                            content: [
                                {
                                    text: message.content || "",
                                },
                            ],
                        },
                    },
                ],
            };
        }

        // Tool calls handling
        if (message.role === "assistant" && message.toolCalls) {
            return {
                role: "assistant",
                content: message.toolCalls.map((toolCall) => ({
                    toolUse: {
                        toolUseId: toolCall.id,
                        name: toolCall.function?.name,
                        input: JSON.parse(toolCall.function?.arguments || "{}"),
                    },
                })),
            };
        }

        if (message.role === "thinking") {
            if (message.redactedThinking) {
                const content: ContentBlock.ReasoningContentMember = {
                    reasoningContent: {
                        redactedContent: new Uint8Array(
                            Buffer.from(message.redactedThinking),
                        ),
                    },
                };
                return {
                    role: "assistant",
                    content: [content],
                };
            } else {
                const content: ContentBlock.ReasoningContentMember = {
                    reasoningContent: {
                        reasoningText: {
                            text: (message.content as string) || "",
                            signature: message.signature,
                        },
                    },
                };
                return {
                    role: "assistant",
                    content: [content],
                };
            }
        }

        // Standard text message
        if (typeof message.content === "string") {
            if (addCaching) {
                message.content += getSecureID();
            }
            const content: any[] = [{ text: message.content }];
            if (addCaching) {
                content.push({ cachePoint: { type: "default" } });
            }
            return {
                role: message.role,
                content,
            };
        }

        // Improved multimodal content handling
        if (Array.isArray(message.content)) {
            const content: any[] = [];

            // Process all parts first
            message.content.forEach((part) => {
                if (part.type === "text") {
                    if (addCaching) {
                        part.text += getSecureID();
                    }
                    content.push({ text: part.text });
                } else if (part.type === "imageUrl" && part.imageUrl) {
                    try {
                        const [mimeType, base64Data] = part.imageUrl.url.split(",");
                        const format = mimeType.split("/")[1]?.split(";")[0] || "jpeg";
                        content.push({
                            image: {
                                format,
                                source: {
                                    bytes: Buffer.from(base64Data, "base64"),
                                },
                            },
                        });
                    } catch (error) {
                        console.warn(`Failed to process image: ${error}`);
                    }
                }
            });

            // Add cache point as a separate block at the end if needed
            if (addCaching && content.length > 0) {
                content.push({ cachePoint: { type: "default" } });
            }

            return {
                role: message.role,
                content,
            } as Message;
        }
        return null;
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
    async *_streamChat(
        messages: ChatMessage[],
        signal: AbortSignal,
        options: CompletionOptions,
    ): AsyncGenerator<ChatMessage> {
        if(!this.creds){
            this.creds = this.setupAiCore()
        }
        const client = new SAPClaudeClient(this.creds);
        const input = this._generateConverseInput(messages, {
            ...options,
            stream: true,
        });
        const response = await client.sendMessage(input);
        const stream = response.data

        function toStrictJson(str: string): string {
            // Wrap it in parentheses so JS will treat it as an expression
            const obj = new Function("return " + str)()
            return JSON.stringify(obj)
        }


        // Buffer for accumulating stream data
        let buffer = '';
        
        try {
            for await (const chunk_str of stream) {
                buffer += chunk_str.toString();
                
                // Process complete JSON objects from the buffer
                let startIdx = 0;
                while (true) {
                    // Find the next "data: " marker
                    const dataPrefix = "data: ";
                    const dataIdx = buffer.indexOf(dataPrefix, startIdx);
                    if (dataIdx === -1) break;
                    
                    // Find the end of this JSON object (next data marker or end of buffer)
                    const nextDataIdx = buffer.indexOf(dataPrefix, dataIdx + dataPrefix.length);
                    
                    // If we found a complete object or end of stream marker
                    if (nextDataIdx !== -1 || buffer.endsWith("\n\n")) {
                        const endIdx = nextDataIdx !== -1 ? nextDataIdx : buffer.length;
                        const jsonData = buffer.substring(dataIdx + dataPrefix.length, endIdx).trim();
                        
                        try {
                            // Try to parse as regular JSON first
                            let chunk;
                            try {
                                chunk = JSON.parse(jsonData);
                            } catch (e) {
                                // If that fails, try with the toStrictJson function
                                try {
                                    chunk = JSON.parse(toStrictJson(jsonData));
                                } catch (e2) {
                                    console.warn("Failed to parse JSON:", jsonData);
                                    startIdx = endIdx;
                                    continue;
                                }
                            }
                            
                            // Process the chunk as before
                            if (chunk.metadata?.usage) {
                                console.log(`${JSON.stringify(chunk.metadata.usage)}`);
                            }

                            if (chunk.contentBlockDelta?.delta) {
                                const delta: any = chunk.contentBlockDelta.delta;

                                // Handle text content
                                if (chunk.contentBlockDelta.delta.text) {
                                    yield {
                                        role: "assistant",
                                        content: chunk.contentBlockDelta.delta.text,
                                    };
                                    startIdx = endIdx;
                                    continue;
                                }

                                // Handle text content
                                if ((chunk.contentBlockDelta.delta as any).reasoningContent?.text) {
                                    yield {
                                        role: "thinking",
                                        content: (chunk.contentBlockDelta.delta as any).reasoningContent
                                            .text,
                                    };
                                    startIdx = endIdx;
                                    continue;
                                }

                                // Handle signature for thinking
                                if (delta.reasoningContent?.signature) {
                                    yield {
                                        role: "thinking",
                                        content: "",
                                        signature: delta.reasoningContent.signature,
                                    };
                                    startIdx = endIdx;
                                    continue;
                                }

                                // Handle redacted thinking
                                if (delta.redactedReasoning?.data) {
                                    yield {
                                        role: "thinking",
                                        content: "",
                                        redactedThinking: delta.redactedReasoning.data,
                                    };
                                    startIdx = endIdx;
                                    continue;
                                }

                                if (
                                    chunk.contentBlockDelta.delta.toolUse?.input &&
                                    this._currentToolResponse
                                ) {
                                    // Append the new input to the existing string
                                    // eslint-disable-next-line max-depth
                                    if (this._currentToolResponse.input === undefined) {
                                        this._currentToolResponse.input = "";
                                    }
                                    this._currentToolResponse.input +=
                                        chunk.contentBlockDelta.delta.toolUse.input;
                                    startIdx = endIdx;
                                    continue;
                                }
                            }

                            if (chunk.contentBlockStart?.start) {
                                const start: any = chunk.contentBlockStart.start;
                                if (start.redactedReasoning) {
                                    yield {
                                        role: "thinking",
                                        content: "",
                                        redactedThinking: start.redactedReasoning.data,
                                    };
                                    startIdx = endIdx;
                                    continue;
                                }

                                const toolUse = chunk.contentBlockStart.start.toolUse;
                                if (toolUse?.toolUseId && toolUse?.name) {
                                    this._currentToolResponse = {
                                        toolUseId: toolUse.toolUseId,
                                        name: toolUse.name,
                                        input: "",
                                    };
                                }
                                startIdx = endIdx;
                                continue;
                            }

                            if (chunk.contentBlockStop) {
                                if (this._currentToolResponse) {
                                    yield {
                                        role: "assistant",
                                        content: "",
                                        toolCalls: [
                                            {
                                                id: this._currentToolResponse.toolUseId,
                                                type: "function",
                                                function: {
                                                    name: this._currentToolResponse.name,
                                                    arguments: this._currentToolResponse.input,
                                                },
                                            },
                                        ],
                                    };
                                    this._currentToolResponse = null;
                                }
                                startIdx = endIdx;
                                continue;
                            }
                            
                            // If we get here, update startIdx to process the next chunk
                            startIdx = endIdx;
                            
                        } catch (error: unknown) {
                            console.warn(`Error processing chunk: ${error instanceof Error ? error.message : String(error)}`);
                            startIdx = endIdx;
                        }
                    } else {
                        // We have an incomplete object, wait for more data
                        break;
                    }
                }
                
                // Keep only the unprocessed part of the buffer
                if (startIdx > 0) {
                    buffer = buffer.substring(startIdx);
                }
            }
        } catch (error: unknown) {
            this._currentToolResponse = null;
            if (error instanceof Error) {
                if ("code" in error) {
                    // AWS SDK specific errors
                    throw new Error(
                        `AWS Bedrock stream error (${(error as any).code}): ${error.message}`,
                    );
                }
                throw new Error(`Error processing Bedrock stream: ${error.message}`);
            }
            throw new Error(
                "Error processing Bedrock stream: Unknown error occurred",
            );
        }
    }


    loadAiCoreCredentials(): SAPClaudeClientOptions | undefined {
        const credsFilePath = path.join(os.homedir(), AI_CORE_CREDS_FILENAME)

        if (!fs.existsSync(credsFilePath)) {
            return undefined
        }

        const fileContents = fs.readFileSync(credsFilePath, "utf-8")
        try {
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

            return parsed
        } catch (e) {
            throw new Error("Failed to parse ai core credentials file:", e as any)
        }
    }

    setupAiCore(): SAPClaudeClientOptions {
        try {
            this.creds = this.loadAiCoreCredentials()
            if(!this.creds){
                throw new Error("AI Core credentials not exist")
            }
            process.env["AICORE_SERVICE_KEY"] = JSON.stringify(this.creds)
            return this.creds;
        } catch (err) {
            throw new Error(`Failed to load AI Core credentials: ${err}`)
        }
    }

}
