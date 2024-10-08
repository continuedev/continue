import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";
import { EmbeddingsProviderName, EmbedOptions, FetchFunction } from "../../index.js";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";

class BedrockCohereEmbeddingsProvider extends BaseEmbeddingsProvider {
  static maxBatchSize = 96;
  static providerName: EmbeddingsProviderName = "bedrock-cohere";
  static defaultOptions: Partial<EmbedOptions> = {
    model: "cohere.embed-english-v3",
    region: "us-east-1"
  };

  private profile?: string;

  constructor(options: EmbedOptions, fetch: FetchFunction) {
    super(options, fetch);
    if (!options.apiBase) {
      this.options.apiBase = `https://bedrock-runtime.${options.region}.amazonaws.com`;
    }
    this.profile = options.profile || "bedrock";
  }

  async embed(chunks: string[]): Promise<number[][]> {
    const credentials = await this._getCredentials();
    const client = new BedrockRuntimeClient({
      region: this.options.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken || "",
      },
    });

    const batchedChunks = this.getBatchedChunks(chunks);
    const embeddings = await Promise.all(
      batchedChunks.map(async (batch) => {
        const input = this._generateInvokeModelCommandInput(batch);
        const command = new InvokeModelCommand(input);
        const response = await client.send(command);

        if (response.body) {
          const responseBody = JSON.parse(new TextDecoder().decode(response.body));
          return responseBody.embeddings;
        }
        return [];
      })
    );

    return embeddings.flat();
  }

  private _generateInvokeModelCommandInput(texts: string[]): any {
    const payload = {
      texts: texts,
      input_type: "search_document",
    };
    return {
      body: JSON.stringify(payload),
      modelId: this.options.model,
      accept: "*/*",
      contentType: "application/json"
    };
  }

  private async _getCredentials() {
    try {
      return await fromIni({
        profile: this.profile
      })();
    } catch (e) {
      console.warn(
        `AWS profile with name ${this.profile} not found in ~/.aws/credentials, using default profile`,
      );
      return await fromIni()();
    }
  }
}

export default BedrockCohereEmbeddingsProvider;