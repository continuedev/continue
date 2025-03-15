import {
    BedrockRuntimeClient,
    InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

import { CompletionOptions, LLMOptions } from "../../index.js";
import { BaseLLM } from "../index.js";

class BedrockImport extends BaseLLM {
  static providerName = "bedrockimport";
  static defaultOptions: Partial<LLMOptions> = {
    region: "us-east-1",
  };
  // the BedRock imported custom model ARN
  modelArn?: string | undefined;

  constructor(options: LLMOptions) {
    super(options);
    if (!options.apiBase) {
      this.apiBase = `https://bedrock-runtime.${options.region}.amazonaws.com`;
    }
    if (options.modelArn) {
      this.modelArn = options.modelArn;
    }
    if (options.profile) {
      this.profile = options.profile;
    } else {
      this.profile = "bedrock";
    }
  }

  protected async *_streamComplete(
    prompt: string,
    signal: AbortSignal,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const credentials = await this._getCredentials();
    const client = new BedrockRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken || "",
      },
    });

    const input = this._generateInvokeModelCommandInput(prompt, options);
    const command = new InvokeModelWithResponseStreamCommand(input);
    const response = await client.send(command, { abortSignal: signal });

    if (response.body) {
      for await (const item of response.body) {
        const chunk = JSON.parse(new TextDecoder().decode(item.chunk?.bytes));
        if (chunk.outputs[0].text) {
          yield chunk.outputs[0].text;
        }
      }
    }
  }

  private _generateInvokeModelCommandInput(
    prompt: string,
    options: CompletionOptions,
  ): any {
    const payload = {
      prompt: prompt,
    };

    return {
      body: JSON.stringify(payload),
      modelId: this.modelArn,
      accept: "application/json",
      contentType: "application/json",
    };
  }

  private async _getCredentials() {
    try {
      return await fromNodeProviderChain({
        profile: this.profile,
        ignoreCache: true,
      })();
    } catch (e) {
      console.warn(
        `AWS profile with name ${this.profile} not found in ~/.aws/credentials, using default profile`,
      );
      return await fromNodeProviderChain()();
    }
  }
}

export default BedrockImport;
