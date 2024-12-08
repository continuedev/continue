import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";

import { Chunk, Reranker } from "../../index.js";

export class BedrockReranker implements Reranker {
  name = "bedrock";

  static defaultOptions = {
    region: "us-east-1",
    model: "amazon.rerank-v1:0",
    profile: "bedrock",
  };

  private supportedModels = ["amazon.rerank-v1:0", "cohere.rerank-v3-5:0"];

  constructor(
    private readonly params: {
      region?: string;
      model?: string;
      profile?: string;
    } = {},
  ) {
    if (params.model && !this.supportedModels.includes(params.model)) {
      throw new Error(
        `Unsupported model: ${params.model}. Supported models are: ${this.supportedModels.join(", ")}`,
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
        region: this.params.region ?? BedrockReranker.defaultOptions.region,
        credentials,
      });

      const model = this.params.model ?? BedrockReranker.defaultOptions.model;

      // Base payload for both models
      const payload: any = {
        query: query,
        documents: chunks.map((chunk) => chunk.content),
        top_n: chunks.length,
      };

      // Add api_version for Cohere model
      if (model.startsWith("cohere.rerank")) {
        payload.api_version = 2;
      }

      const input = {
        body: JSON.stringify(payload),
        modelId: model,
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
        profile: this.params.profile ?? BedrockReranker.defaultOptions.profile,
        ignoreCache: true,
      })();
      return credentials;
    } catch (e) {
      console.warn(
        `AWS profile with name ${this.params.profile ?? BedrockReranker.defaultOptions.profile} not found in ~/.aws/credentials, using default profile`,
      );
      return await fromIni()();
    }
  }
}
