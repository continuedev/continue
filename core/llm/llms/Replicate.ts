import { LLM, LLMOptions } from "..";
import { ModelProvider } from "../../config";
import { ChatMessage, CompletionOptions } from "../types";
import ReplicateClient from "replicate";

class Replicate extends LLM {
  private static MODEL_IDS: {
    [name: string]: `${string}/${string}:${string}`;
  } = {
    "codellama-7b":
      "meta/codellama-7b-instruct:6527b83e01e41412db37de5110a8670e3701ee95872697481a355e05ce12af0e",
    "codellama-13b":
      "meta/codellama-13b-instruct:1f01a52ff933873dff339d5fb5e1fd6f24f77456836f514fa05e91c1a42699c7",
    "codellama-34b":
      "meta/codellama-34b-instruct:8281a5c610f6e88237ff3ddaf3c33b56f60809e2bdd19fbec2fda742aa18167e",
    "llama2-7b":
      "meta/llama-2-7b-chat:8e6975e5ed6174911a6ff3d60540dfd4844201974602551e10e9e87ab143d81e",
    "llama2-13b":
      "meta/llama-2-13b-chat:f4e2de70d66816a838a89eeeb621910adffb0dd0baba3976c96980970978018d",
    "zephyr-7b":
      "nateraw/zephyr-7b-beta:b79f33de5c6c4e34087d44eaea4a9d98ce5d3f3a09522f7328eea0685003a931",
    "mistral-7b":
      "mistralai/mistral-7b-instruct-v0.1:83b6a56e7c828e667f21fd596c338fd4f0039b46bcfa18d973e8e70e455fda70",
    "wizardcoder-34b":
      "andreasjansson/wizardcoder-python-34b-v1-gguf:67eed332a5389263b8ede41be3ee7dc119fa984e2bde287814c4abed19a45e54",
  };

  static providerName: ModelProvider = "replicate";
  private _replicate: ReplicateClient;

  private _convertArgs(
    options: CompletionOptions,
    prompt: string
  ): [`${string}/${string}:${string}`, { input: any }] {
    return [
      Replicate.MODEL_IDS[options.model] || (options.model as any),
      {
        input: { prompt, message: prompt },
      },
    ];
  }

  constructor(options: LLMOptions) {
    super(options);
    this._replicate = new ReplicateClient({ auth: options.apiKey });
  }

  protected async _complete(
    prompt: string,
    options: CompletionOptions
  ): Promise<string> {
    const [model, args] = this._convertArgs(options, prompt);
    const response = await this._replicate.run(model, args);

    return (response as any)[0];
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions
  ): AsyncGenerator<string> {
    yield await this._complete(prompt, options);
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<ChatMessage> {
    const resp = await this.complete(messages[0]?.content || "", options);
  }
}

export default Replicate;
