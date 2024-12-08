import {
  InvokeEndpointCommand,
  SageMakerRuntimeClient,
} from "@aws-sdk/client-sagemaker-runtime";
import { fromIni } from "@aws-sdk/credential-providers";

import { LLMOptions } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";

class SageMakerEmbeddingsProvider extends BaseLLM {
  static providerName = "sagemaker";

  static defaultOptions: Partial<LLMOptions> | undefined = {
    region: "us-west-2",
    maxEmbeddingBatchSize: 1,
    profile: "sagemaker",
  };

  constructor(options: LLMOptions) {
    super(options);
    this.apiBase ??= `https://runtime.sagemaker.${options.region}.amazonaws.com`;
  }

  async embed(chunks: string[]) {
    const credentials = await this._getCredentials();
    const client = new SageMakerRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken || "",
      },
    });

    const batchedChunks = this.getBatchedChunks(chunks);
    return (
      await Promise.all(
        batchedChunks.map(async (batch) => {
          const input = this._generateInvokeModelCommandInput(batch);
          const command = new InvokeEndpointCommand(input);
          const response = await client.send(command);

          if (response.Body) {
            const responseBody = JSON.parse(
              new TextDecoder().decode(response.Body),
            );
            // If the body contains a key called "embedding" or "embeddings", return the value, otherwise return the whole body
            if (responseBody.embedding) {
              return responseBody.embedding;
            } else if (responseBody.embeddings) {
              return responseBody.embeddings;
            } else {
              return responseBody;
            }
          }
        }),
      )
    ).flat();
  }
  private _generateInvokeModelCommandInput(prompts: string | string[]): any {
    const payload = {
      inputs: prompts,
      normalize: true,
      // ...(options.requestOptions?.extraBodyProperties || {}),
    };

    if (this.requestOptions?.extraBodyProperties) {
      Object.assign(payload, this.requestOptions.extraBodyProperties);
    }

    return {
      EndpointName: this.model,
      Body: JSON.stringify(payload),
      ContentType: "application/json",
      CustomAttributes: "accept_eula=false",
    };
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

export default SageMakerEmbeddingsProvider;
