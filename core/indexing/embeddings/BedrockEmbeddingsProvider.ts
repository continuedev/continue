import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";
import { EmbeddingsProviderName, EmbedOptions, FetchFunction } from "../../index.js";
import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";

class BedrockEmbeddingsProvider extends BaseEmbeddingsProvider {

  static providerName: EmbeddingsProviderName = "bedrock";

  static defaultOptions: Partial<EmbedOptions> | undefined = {
    model: "amazon.titan-embed-text-v2:0",
    region: "us-east-1"
  };
  profile?: string | undefined;

  constructor(options: EmbedOptions, fetch: FetchFunction) {
    super(options, fetch);
    if (!options.apiBase) {
      options.apiBase = `https://bedrock-runtime.${options.region}.amazonaws.com`;
    }

    if (options.profile) {
      this.profile = options.profile;
    } else {
      this.profile = "bedrock";
    }
  }

  async embed(chunks: string[]) {
    const credentials = await this._getCredentials();
    const client = new BedrockRuntimeClient({
      region: this.options.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken || "",
      },
    });

    return (
      await Promise.all(
        chunks.map(async (chunk) => {
          const input = this._generateInvokeModelCommandInput(chunk, this.options);
          const command = new InvokeModelCommand(input);
          const response = await client.send(command);

          if (response.body) {
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            return [responseBody.embedding];
          }
        }),
      )
    ).flat();
  }

  private _generateInvokeModelCommandInput(
    prompt: string,
    options: EmbedOptions,
  ): any {
    const payload = {
      "inputText": prompt,
      "dimensions": 512,
      "normalize": true
    };

    return {
      body: JSON.stringify(payload),
      modelId: this.options.model,
      accept: "application/json",
      contentType: "application/json"
    };
  }

  private async _getCredentials() {
    try {
      return await
      fromIni({
        profile: this.profile,
        ignoreCache: true
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
