import { streamResponse, streamSse } from "@continuedev/fetch";
import {
  AssistantChatMessage,
  ChatMessage,
  Chunk,
  CompletionOptions,
  LLMOptions,
  TextMessagePart,
  ToolCallDelta,
  ToolResultChatMessage,
} from "../../index.js";
import { BaseLLM } from "../index.js";
import { fromChatCompletionChunk } from "../openaiTypeConverters.js";

let watsonxToken = {
  expiration: 0,
  token: "",
};

class WatsonX extends BaseLLM {
  static defaultOptions: Partial<LLMOptions> | undefined = {
    maxEmbeddingBatchSize: 1000,
  };

  constructor(options: LLMOptions) {
    super(options);
  }

  async getBearerToken(): Promise<{ token: string; expiration: number }> {
    if (this.apiBase?.includes("cloud.ibm.com")) {
      // watsonx SaaS
      const wxToken = await (
        await this.fetch(
          `https://iam.cloud.ibm.com/identity/token?apikey=${this.apiKey}&grant_type=urn:ibm:params:oauth:grant-type:apikey`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
          },
        )
      ).json();
      return {
        token: wxToken["access_token"],
        expiration: wxToken["expiration"],
      };
    } else {
      // watsonx Software
      if (!this.apiKey?.includes(":")) {
        // Using ZenApiKey auth
        return {
          token: this.apiKey ?? "",
          expiration: -1,
        };
      } else {
        // Using username/password auth
        const userPass = this.apiKey?.split(":");
        const wxToken = await (
          await this.fetch(`${this.apiBase}/icp4d-api/v1/authorize`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              username: userPass[0],
              password: userPass[1],
            }),
          })
        ).json();
        const wxTokenExpiry = await (
          await this.fetch(`${this.apiBase}/usermgmt/v1/user/tokenExpiry`, {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${wxToken["token"]}`,
            },
          })
        ).json();
        return {
          token: wxToken["token"],
          expiration: wxTokenExpiry["exp"],
        };
      }
    }
  }

  _getEndpoint(endpoint: string): string {
    return `${this.apiBase}/ml/v1/${this.deploymentId ? `deployments/${this.deploymentId}/` : ""}text/${endpoint}_stream?version=${this.apiVersion}`;
  }

  static providerName = "watsonx";

  protected _convertMessage(message: ChatMessage) {
    let message_ = message as any;
    if (message_.role === "tool") {
      message_.tool_call_id = (message as ToolResultChatMessage).toolCallId;
      delete message_.toolCallId;
    } else if (message.role === "assistant" && !!message.toolCalls) {
      message_.tool_calls = message.toolCalls.map((t) => ({
        ...t,
        type: "function",
      }));
      delete message_.toolCalls;
      delete message_.content;
    } else if (message_.role === "user") {
      if (typeof message.content === "string") {
        message_.content = [{ type: "text", text: message_.content }];
      } else {
        return {
          role: "user",
          content: !message.content.some((item) => item.type !== "text")
            ? message.content
                .map((item) => (item as TextMessagePart).text)
                .join("") || " "
            : message.content.map((part) => {
                if (part.type === "imageUrl") {
                  return {
                    type: "image_url" as const,
                    image_url: {
                      url: part.imageUrl.url,
                      detail: "auto" as const,
                    },
                  };
                }
                return part;
              }),
        };
      }
    }
    return message_;
  }

  protected _convertArgs(options: any, messages: ChatMessage[]) {
    const finalOptions = {
      messages: messages.map(this._convertMessage).filter(Boolean),
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
    };
    return finalOptions;
  }

  protected _getHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `${
        watsonxToken.expiration === -1 ? "ZenApiKey" : "Bearer"
      } ${watsonxToken.token}`,
    };
  }

  protected async updateWatsonxToken() {
    var now = new Date().getTime() / 1000;
    if (
      watsonxToken === undefined ||
      now > watsonxToken.expiration ||
      watsonxToken.token === undefined
    ) {
      watsonxToken = await this.getBearerToken();
    } else {
      console.log(
        `Reusing token (expires in ${
          (watsonxToken.expiration - now) / 60
        } mins)`,
      );
    }
    if (watsonxToken.token === undefined) {
      throw new Error("Something went wrong. Check your credentials, please.");
    }
  }

  protected async _complete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): Promise<string> {
    let completion = "";
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      signal,
      options,
    )) {
      completion += chunk.content;
    }

    return completion;
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    await this.updateWatsonxToken();

    const stopSequences = options.stop?.slice(0, 6) ?? [];
    const url = this._getEndpoint("generation");
    const headers = this._getHeaders();

    const parameters: any = {
      decoding_method: "greedy",
      max_new_tokens: options.maxTokens ?? 1024,
      min_new_tokens: 1,
      stop_sequences: stopSequences,
      include_stop_sequence: false,
      truncate_input_tokens: this.contextLength - (options.maxTokens ?? 1024),
      repetition_penalty: options.frequencyPenalty || 1,
    };
    if (!!options.temperature) {
      parameters.decoding_method = "sample";
      parameters.temperature = options.temperature;
      parameters.top_p = options.topP || 1.0;
      parameters.top_k = options.topK || 100;
    }

    const payload: any = {
      input: prompt,
      parameters: parameters,
    };
    if (!this.deploymentId) {
      payload.model_id = options.model;
      payload.project_id = this.projectId;
    }

    const response = await this.fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
      signal,
    });

    for await (const value of streamResponse(response)) {
      const lines = value.split("\n");
      let generatedChunk = "";
      let generatedTextIndex = undefined;
      lines.forEach((el: string) => {
        // console.log(`${el}`);
        if (el.startsWith("id:")) {
          generatedTextIndex = parseInt(el.replace(/^id:\s+/, ""));
          if (isNaN(generatedTextIndex)) {
            console.error(`Unable to parse stream chunk ID: ${el}`);
          }
        } else if (el.startsWith("data:")) {
          const dataStr = el.replace(/^data:\s+/, "");
          try {
            const data = JSON.parse(dataStr);
            data.results.forEach((result: any) => {
              generatedChunk += result.generated_text || "";
            });
          } catch (e) {
            // parsing error is expected with streaming response
            // console.error(`Error parsing JSON string: ${dataStr}`, e);
          }
        }
      });
      yield generatedChunk;
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    await this.updateWatsonxToken();

    const stopSequences = options.stop?.slice(0, 6) ?? [];
    const url = this._getEndpoint("chat");
    const headers = this._getHeaders();

    const payload: any = {
      messages: messages.map(this._convertMessage).filter(Boolean),
      max_tokens: options.maxTokens ?? 1024,
      stop: stopSequences,
      frequency_penalty: options.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? 0,
    };

    if (!this.deploymentId) {
      payload.model_id = options.model;
      payload.project_id = this.projectId;
    }

    if (!!options.temperature) {
      payload.temperature = options.temperature;
    }
    if (!!options.topP) {
      payload.top_p = options.topP;
    }
    if (!!options.tools) {
      payload.tools = options.tools;
      if (options.toolChoice) {
        payload.tool_choice = options.toolChoice;
      } else {
        payload.tool_choice_option = "auto";
      }
    }

    const response = await this.fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
      signal,
    });

    let toolName;
    let toolCallId = null;
    let accumulatedArgs = "";

    for await (const value of streamSse(response)) {
      const message = fromChatCompletionChunk(value);
      if (!!message) {
        if (
          (message as AssistantChatMessage)?.toolCalls &&
          (message as AssistantChatMessage).toolCalls?.length !== 0
        ) {
          let chunk = message as AssistantChatMessage;
          if (!!chunk.toolCalls?.[0]?.id) {
            toolCallId = chunk.toolCalls?.[0]?.id;
          }
          if (!!chunk.toolCalls?.[0]?.function?.name) {
            accumulatedArgs = "";
            toolName = chunk.toolCalls[0].function.name;
            continue;
          }
          if (!!toolName) {
            if (value?.choices?.[0]?.finish_reason === "tool_calls") {
              // If final assistant message has "tool_calls" as finish_reason
              let args: string | undefined;
              try {
                accumulatedArgs += chunk.toolCalls?.[0]?.function?.arguments;
                // Check if accumulated argument chunks are parsable
                args = JSON.stringify(JSON.parse(accumulatedArgs));
              } catch (e) {
                // Otherwise use arguments from final assistant tool call message
                args = chunk.toolCalls?.[0]?.function?.arguments;
              }
              const toolCall = {
                function: { name: toolName, arguments: args },
                id: toolCallId,
              };
              chunk.toolCalls = [toolCall as ToolCallDelta];
            } else {
              if (!!chunk.toolCalls?.[0]?.function?.arguments)
                accumulatedArgs += chunk.toolCalls?.[0]?.function?.arguments;
              continue;
            }
          }
          yield chunk;
        } else {
          yield message;
        }
      }
    }
  }

  protected async _embed(chunks: string[]): Promise<number[][]> {
    await this.updateWatsonxToken();

    const payload: any = {
      inputs: chunks,
      parameters: {
        truncate_input_tokens: 500,
        return_options: { input_text: false },
      },
      model_id: this.model,
      project_id: this.projectId,
    };
    const headers = {
      "Content-Type": "application/json",
      Authorization: `${
        watsonxToken.expiration === -1 ? "ZenApiKey" : "Bearer"
      } ${watsonxToken.token}`,
    };
    const resp = await this.fetch(
      new URL(
        `${this.apiBase}/ml/v1/text/embeddings?version=${this.apiVersion}`,
      ),
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers: headers,
      },
    );

    if (!resp.ok) {
      throw new Error(`Failed to embed chunk: ${await resp.text()}`);
    }
    const data = await resp.json();
    const embeddings = data.results;

    if (!embeddings || embeddings.length === 0) {
      throw new Error("Watsonx generated empty embedding");
    }
    return embeddings.map((e: any) => e.embedding);
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    if (!query || !chunks.length) {
      throw new Error("Query and chunks must not be empty");
    }
    try {
      await this.updateWatsonxToken();

      const headers = {
        "Content-Type": "application/json",
        Authorization: `${
          watsonxToken.expiration === -1 ? "ZenApiKey" : "Bearer"
        } ${watsonxToken.token}`,
      };

      const payload: any = {
        inputs: chunks.map((chunk) => ({ text: chunk.content })),
        query: query,
        parameters: {
          truncate_input_tokens: 500,
          return_options: {
            top_n: chunks.length,
          },
        },
        model_id: this.model,
        project_id: this.projectId,
      };

      const resp = await this.fetch(
        new URL(`${this.apiBase}/ml/v1/text/rerank?version=${this.apiVersion}`),
        {
          method: "POST",
          headers: headers,
          body: JSON.stringify(payload),
        },
      );

      if (!resp.ok) {
        throw new Error(`Failed to rerank chunks: ${await resp.text()}`);
      }
      const data = await resp.json();
      const ranking = data.results;

      if (!ranking) {
        throw new Error("Empty response received from Watsonx");
      }

      // Sort results by index to maintain original order
      return ranking
        .sort((a: any, b: any) => a.index - b.index)
        .map((result: any) => result.score);
    } catch (error) {
      console.error("Error in WatsonxReranker.rerank:", error);
      throw error;
    }
  }
}

export default WatsonX;
