import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";

import { LLMOptions } from "../../index.js";

import { BaseLLM } from "../../llm/index.js";

interface ModelConfig {
  formatPayload: (text: string) => any;
  extractEmbeddings: (responseBody: any) => number[][];
}

class BedrockEmbeddingsProvider extends BaseLLM {
  static providerName = "bedrock";
  static defaultOptions: Partial<LLMOptions> = {
    model: "amazon.titan-embed-text-v2:0",
    region: "us-east-1",
    profile: "bedrock",
  };
  profile?: string | undefined;

  constructor(options: LLMOptions) {
    super(options);

    if (!this.apiBase) {
      this.apiBase = `https://bedrock-runtime.${options.region}.amazonaws.com`;
    }
  }

  async embed(chunks: string[]): Promise<number[][]> {
    const credentials = await this._getCredentials();
    const client = new BedrockRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken || "",
      },
    });

    return (
      await Promise.all(
        chunks.map(async (chunk) => {
          const input = this._generateInvokeModelCommandInput(chunk);
          const command = new InvokeModelCommand(input);
          const response = await client.send(command);
          if (response.body) {
            const responseBody = JSON.parse(
              new TextDecoder().decode(response.body),
            );
            return this._extractEmbeddings(responseBody);
          }
          return [];
        }),
      )
    ).flat();
  }

  private _generateInvokeModelCommandInput(text: string): any {
    const modelConfig = this._getModelConfig();
    const payload = modelConfig.formatPayload(text);

    return {
      body: JSON.stringify(payload),
      modelId: this.model,
      accept: "*/*",
      contentType: "application/json",
    };
  }

  private _extractEmbeddings(responseBody: any): number[][] {
    const modelConfig = this._getModelConfig();
    return modelConfig.extractEmbeddings(responseBody);
  }

  private _getModelConfig() {
    const modelConfigs: { [key: string]: ModelConfig } = {
      cohere: {
        formatPayload: (text: string) => ({
          texts: [text],
          input_type: "search_document",
          truncate: "END",
        }),
        extractEmbeddings: (responseBody: any) => responseBody.embeddings || [],
      },
      "amazon.titan-embed": {
        formatPayload: (text: string) => ({
          inputText: text,
        }),
        extractEmbeddings: (responseBody: any) =>
          responseBody.embedding ? [responseBody.embedding] : [],
      },
    };

    const modelPrefix = Object.keys(modelConfigs).find((prefix) =>
      this.model!.startsWith(prefix),
    );
    if (!modelPrefix) {
      throw new Error(`Unsupported model: ${this.model}`);
    }
    return modelConfigs[modelPrefix];
  }

  private async _getCredentials() {
    try {
      return await fromIni({
        profile: this.profile,
        ignoreCache: true,
      })();
    } catch (e) {
      console.warn(
        `AWS profile with name ${this.profile} not found in ~/.aws/credentials, using default profile`,
      );
      return await fromIni()();
    }
  }
}

export default BedrockEmbeddingsProvider;
