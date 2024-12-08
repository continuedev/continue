import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";

import { Chunk, LLMOptions } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";

export class BedrockReranker extends BaseLLM {
  static providerName = "bedrock";

  static defaultOptions: Partial<LLMOptions> | undefined = {
    region: "us-east-1",
    model: "amazon.rerank-v1:0",
    profile: "bedrock",
  };

  private supportedModels = ["amazon.rerank-v1:0", "cohere.rerank-v3-5:0"];

  constructor(options: LLMOptions) {
    super(options);
    if (options.model && !this.supportedModels.includes(options.model)) {
      throw new Error(
        `Unsupported model: ${options.model}. Supported models are: ${this.supportedModels.join(", ")}`,
      );
    }
  }

  async rerank(query: string, chunks: Chunk[]): Promise<number[]> {
    if (!query || !chunks.length) {
      throw new Error("Query and chunks must not be empty");
    }

    try {
      const credentials = await this._getCredentials();
      const client = new BedrockRuntimeClient({
        region: this.region,
        credentials,
      });

      // Base payload for both models
      const payload: any = {
        query: query,
        documents: chunks.map((chunk) => chunk.content),
        top_n: chunks.length,
      };

      // Add api_version for Cohere model
      if (this.model.startsWith("cohere.rerank")) {
        payload.api_version = 2;
      }

      const input = {
        body: JSON.stringify(payload),
        modelId: this.model,
        accept: "*/*",
        contentType: "application/json",
      };

      const command = new InvokeModelCommand(input);
      const response = await client.send(command);

      if (!response.body) {
        throw new Error("Empty response received from Bedrock");
      }

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Sort results by index to maintain original order
      return responseBody.results
        .sort((a: any, b: any) => a.index - b.index)
        .map((result: any) => result.relevance_score);
    } catch (error) {
      console.error("Error in BedrockReranker.rerank:", error);
      throw error;
    }
  }

  private async _getCredentials() {
    try {
      const credentials = await fromIni({
        profile: this.profile,
        ignoreCache: true,
      })();
      return credentials;
    } catch (e) {
      console.warn(
        `AWS profile with name ${this.profile} not found in ~/.aws/credentials, using default profile`,
      );
      return await fromIni()();
    }
  }
}
