import {
    InvokeEndpointCommand,
    SageMakerRuntimeClient,
  } from "@aws-sdk/client-sagemaker-runtime";
  import { fromIni } from "@aws-sdk/credential-providers";
  
  import {
    EmbeddingsProviderName,
    EmbedOptions,
    FetchFunction,
  } from "../../index.js";
  import BaseEmbeddingsProvider from "./BaseEmbeddingsProvider.js";
  
  
  class SageMakerEmbeddingsProvider extends BaseEmbeddingsProvider {
    static providerName: EmbeddingsProviderName = "sagemaker";
  
    static defaultOptions: Partial<EmbedOptions> | undefined = {
      region: "us-west-2",
      maxBatchSize: 1,
    };
    profile?: string | undefined;
  
    constructor(options: EmbedOptions, fetch: FetchFunction) {
      super(options, fetch);
      if (!options.apiBase) {
        options.apiBase = `https://runtime.sagemaker.${options.region}.amazonaws.com`;
      }
  
      if (options.profile) {
        this.profile = options.profile;
      } else {
        this.profile = "sagemaker";
      }
    }
  
    async embed(chunks: string[]) {
      const credentials = await this._getCredentials();
      const client = new SageMakerRuntimeClient({
        region: this.options.region,
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
            const input = this._generateInvokeModelCommandInput(
              batch,
              this.options,
            );
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
    private _generateInvokeModelCommandInput(
      prompts: string | string[],
      options: EmbedOptions,
    ): any {
      const payload = {
        inputs: prompts,
        normalize: true,
        // ...(options.requestOptions?.extraBodyProperties || {}),
      };
  
      if (options.requestOptions?.extraBodyProperties) {
        Object.assign(payload, options.requestOptions.extraBodyProperties);
      }
  
      return {
        EndpointName: this.options.model,
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
  