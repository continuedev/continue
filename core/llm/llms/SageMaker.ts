import {
  InvokeEndpointWithResponseStreamCommand,
  SageMakerRuntimeClient
} from "@aws-sdk/client-sagemaker-runtime";
import { fromIni } from "@aws-sdk/credential-providers";

// @ts-ignore
import jinja from "jinja-js";

import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider
} from "../../index.js";
import { BaseLLM } from "../index.js";

class SageMaker extends BaseLLM {
  private static PROFILE_NAME: string = "sagemaker";
  static providerName: ModelProvider = "sagemaker";
  static defaultOptions: Partial<LLMOptions> = {
    region: "us-west-2",
    contextLength: 200_000,
  };

  constructor(options: LLMOptions) {
    super(options);
    if (!options.apiBase) {
      this.apiBase = `https://runtime.sagemaker.${options.region}.amazonaws.com`;
    }
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    const credentials = await this._getCredentials();
    const client = new SageMakerRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken || "",
      },
    });
    const toolkit = new CompletionAPIToolkit(this);
    const command = toolkit.generateCommand([], prompt, options);
    const response = await client.send(command);
    if (response.Body) {
      let buffer = "";
      for await (const rawValue of response.Body) {
        const binaryChunk = rawValue.PayloadPart?.Bytes;
        let value = new TextDecoder().decode(binaryChunk);
        buffer += value;
        let position;
        while ((position = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, position);
          try {
            const data = JSON.parse(line.replace(/^data:/, ""));
            let text = undefined;
            if ("choices" in data) {
              if ("delta" in data.choices[0]) {
                text = data.choices[0].delta.content;
              }
              else {
                text = data.choices[0].text;
              }
            }
            else if ("token" in data) {
              text = data.token.text;
            }
            if (text !== undefined) {
              yield text;
            }
          } catch (e) {
          }
          buffer = buffer.slice(position + 1);
        }
      }
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    const credentials = await this._getCredentials();
    const client = new SageMakerRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken || "",
      },
    });
    const toolkit = new MessageAPIToolkit(this);

    const command = toolkit.generateCommand(messages, "", options);
    const response = await client.send(command);
    if (response.Body) {
      let buffer = "";
      for await (const rawValue of response.Body) {
        const binaryChunk = rawValue.PayloadPart?.Bytes;
        let value = new TextDecoder().decode(binaryChunk);
        buffer += value;
        let position;
        while ((position = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, position);
          try {
            const data = JSON.parse(line.replace(/^data:/, ""));
            let text = undefined;
            if ("choices" in data) {
              if ("delta" in data.choices[0]) {
                text = data.choices[0].delta.content;
              }
              else {
                text = data.choices[0].text;
              }
            }
            else if ("token" in data) {
              text = data.token.text;
            }
            if (text !== undefined) {
              yield { role: "assistant", content: text };
            }
          } catch (e) {
          }
          buffer = buffer.slice(position + 1);
        }
      }
    }
  }

  private async _getCredentials() {
    try {
      return await fromIni({
        profile: SageMaker.PROFILE_NAME,
      })();
    } catch (e) {
      console.warn(
        `AWS profile with name ${SageMaker.PROFILE_NAME} not found in ~/.aws/credentials, using default profile`,
      );
      return await fromIni()();
    }
  }

}

interface SageMakerModelToolkit {
  generateCommand(
    messages: ChatMessage[],
    prompt: string,
    options: CompletionOptions,
  ): InvokeEndpointWithResponseStreamCommand;
}

class MessageAPIToolkit implements SageMakerModelToolkit {
  constructor(private sagemaker: SageMaker) { }
  generateCommand(
    messages: ChatMessage[],
    prompt: string,
    options: CompletionOptions,
  ): InvokeEndpointWithResponseStreamCommand {

    if ("chat_template" in this.sagemaker.completionOptions) {
      // for some model you can apply chat_template to the model
      let prompt = jinja.compile(this.sagemaker.completionOptions.chat_template).render(
        { messages: messages, add_generation_prompt: true },
        { autoEscape: false }
      );
      const payload = {
        inputs: prompt,
        parameters: this.sagemaker.completionOptions,
        stream: true,
      };

      return new InvokeEndpointWithResponseStreamCommand({
        EndpointName: options.model,
        Body: new TextEncoder().encode(JSON.stringify(payload)),
        ContentType: "application/json",
        CustomAttributes: "accept_eula=false",
      });
    }
    else {
      const payload = {
        messages: messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        top_p: options.topP,
        top_k: options.topK,
        stop: options.stop,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stream: true,
      };

      return new InvokeEndpointWithResponseStreamCommand({
        EndpointName: options.model,
        Body: new TextEncoder().encode(JSON.stringify(payload)),
        ContentType: "application/json",
        CustomAttributes: "accept_eula=false",
      });
    }

  }
}
class CompletionAPIToolkit implements SageMakerModelToolkit {
  constructor(private sagemaker: SageMaker) { }
  generateCommand(
    messages: ChatMessage[],
    prompt: string,
    options: CompletionOptions,
  ): InvokeEndpointWithResponseStreamCommand {
    const payload = {
      inputs: prompt,
      prompt: prompt,
      parameters: this.sagemaker.completionOptions,
      stream: true,
    };

    return new InvokeEndpointWithResponseStreamCommand({
      EndpointName: options.model,
      Body: new TextEncoder().encode(JSON.stringify(payload)),
      ContentType: "application/json",
      CustomAttributes: "accept_eula=false",
    });
  }
}

export default SageMaker;
