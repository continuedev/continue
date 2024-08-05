import {
  SageMakerRuntimeClient,
  InvokeEndpointWithResponseStreamCommand
} from "@aws-sdk/client-sagemaker-runtime";
import { fromIni } from "@aws-sdk/credential-providers";

const jinja = require("jinja-js");

import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  MessageContent,
  ModelProvider,
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
      for await (const value of response.Body) {
        const text = toolkit.unwrapResponseChunk(value);
        if (text) {
          yield text;
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
      for await (const value of response.Body) {
        const text = toolkit.unwrapResponseChunk(value);
        if (text) {
          yield { role: "assistant", content: text };
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
  unwrapResponseChunk(rawValue: any): string;
}

class MessageAPIToolkit implements SageMakerModelToolkit {
  constructor(private sagemaker: SageMaker) {}
  generateCommand(
    messages: ChatMessage[],
    prompt: string,
    options: CompletionOptions,
  ): InvokeEndpointWithResponseStreamCommand {

    if ("chat_template" in this.sagemaker.completionOptions) {
      // for some model you can apply chat_template to the model
      let prompt = jinja.compile(this.sagemaker.completionOptions.chat_template).render(
        {messages: messages, add_generation_prompt: true}, 
        {autoEscape: false}
      )
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
        stream: "true",
      };
  
      return new InvokeEndpointWithResponseStreamCommand({
        EndpointName: options.model,
        Body: new TextEncoder().encode(JSON.stringify(payload)),
        ContentType: "application/json",
        CustomAttributes: "accept_eula=false",
      });
    }

  }
  unwrapResponseChunk(rawValue: any): string {
    const binaryChunk = rawValue.PayloadPart?.Bytes;
    const textChunk = new TextDecoder().decode(binaryChunk);
    try {
      const chunk = JSON.parse(textChunk)
      if ("choices" in chunk) {
        return chunk.choices[0].delta.content;
      }
      else if ("token" in chunk) {
        return chunk.token.text;
      }
      else {
        return "";
      }
    } catch (error) {
      console.error(textChunk);
      console.error(error);
      return "";
    }
  }
}
class CompletionAPIToolkit implements SageMakerModelToolkit {
  constructor(private sagemaker: SageMaker) {}
  generateCommand(
    messages: ChatMessage[],
    prompt: string,
    options: CompletionOptions,
  ): InvokeEndpointWithResponseStreamCommand {
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
  unwrapResponseChunk(rawValue: any): string {
    const binaryChunk = rawValue.PayloadPart?.Bytes;
    const textChunk = new TextDecoder().decode(binaryChunk);
    try {
      return JSON.parse(textChunk).token.text;
    } catch (error) {
      console.error(textChunk);
      console.error(error);
      return "";
    }
  }
}


export default SageMaker;
