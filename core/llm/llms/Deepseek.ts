import { streamSse } from "@continuedev/fetch";
import {
  AssistantChatMessage,
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ThinkingChatMessage,
} from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import { LlmApiRequestType } from "../openaiTypeConverters";
import OpenAI from "./OpenAI.js";

class Deepseek extends OpenAI {
  static providerName = "deepseek";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.deepseek.com/",
    model: "deepseek-coder",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };
  maxStopWords: number | undefined = 16;

  protected useOpenAIAdapterFor: (LlmApiRequestType | "*")[] = [];

  supportsFim(): boolean {
    return true;
  }

  async *_streamFim(
    prefix: string,
    suffix: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const endpoint = new URL("beta/completions", this.apiBase);
    const resp = await this.fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: options.model,
        prompt: prefix,
        suffix,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stop: options.stop,
        stream: true,
      }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal,
    });
    for await (const chunk of streamSse(resp)) {
      yield chunk.choices[0].text;
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage, any, any> {
    const body = this._convertArgs(options, messages);

    const response = await this.fetch(this._getEndpoint("chat/completions"), {
      method: "POST",
      headers: this._getHeaders(),
      body: JSON.stringify({
        ...body,
        ...this.extraBodyProperties(),
      }),
      signal,
    });

    // Handle non-streaming response
    if (body.stream === false) {
      if (response.status === 499) {
        return; // Aborted by user
      }
      const data = await response.json();
      yield data.choices[0].message;
      return;
    }

    let message: AssistantChatMessage | ThinkingChatMessage | undefined;
    let myArguments: string | undefined;
    let lastMessageRole: "assistant" | "thinking" | undefined;

    function fromChatCompletionChunk(chunk: any): ChatMessage | undefined {
      const delta = chunk.choices?.[0]?.delta;

      if (delta?.content) {
        lastMessageRole = "assistant";
        return {
          role: "assistant",
          content: delta.content,
        };
      } else if (delta?.reasoning_content) {
        lastMessageRole = "thinking";
        return {
          role: "thinking",
          content: delta.reasoning_content,
        };
      } else if (delta?.tool_calls) {
        if (!message) {
          message = {
            role: "assistant",
            content: "",
            toolCalls: delta?.tool_calls.map((tool_call: any) => ({
              id: tool_call.id,
              type: tool_call.type,
              function: {
                name: tool_call.function?.name,
                arguments: tool_call.function?.arguments,
              },
            })),
          };
          myArguments = "";
          return message;
        } else {
          // @ts-ignore
          myArguments += delta?.tool_calls[0].function.arguments;
        }
        return undefined;
      }

      if (chunk.choices?.[0]?.finish_reason === "tool_calls") {
        if (message) {
          message = {
            role: message.role,
            content: message.content,
            toolCalls: [
              {
                id: message.toolCalls?.[0].id,
                type: message.toolCalls?.[0].type,
                function: {
                  name: message.toolCalls?.[0].function?.name,
                  arguments: myArguments,
                },
              },
            ],
          };
          const tempMessage = message;
          message = undefined;
          return tempMessage;
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }

    for await (const value of streamSse(response)) {
      const chunk = fromChatCompletionChunk(value);
      if (chunk) {
        yield chunk;
      }
    }
  }
}

export default Deepseek;
