import { ChatMessage, LLMOptions } from "../../index.js";
import { codestralEditPrompt } from "../templates/edit/codestral.js";

import OpenAI from "./OpenAI.js";

type MistralApiKeyType = "mistral" | "codestral";

class Mistral extends OpenAI {
  static providerName = "mistral";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.mistral.ai/v1/",
    model: "codestral-latest",
    promptTemplates: {
      edit: codestralEditPrompt,
    },
    maxEmbeddingBatchSize: 128,
  };

  private async autodetectApiKeyType(): Promise<MistralApiKeyType> {
    const mistralResp = await fetch("https://api.mistral.ai/v1/models", {
      method: "GET",
      headers: this._getHeaders(),
    });
    if (mistralResp.status === 401) {
      return "codestral";
    }
    return "mistral";
  }

  constructor(options: LLMOptions) {
    super(options);
    if (
      options.model.includes("codestral") &&
      !options.model.includes("mamba")
    ) {
      this.apiBase = options.apiBase ?? "https://codestral.mistral.ai/v1/";
    }

    if (!this.apiBase?.endsWith("/")) {
      this.apiBase += "/";
    }

    // Unless the user explicitly specifies, we will autodetect the API key type and adjust the API base accordingly
    if (!options.apiBase) {
      this.autodetectApiKeyType()
        .then((keyType) => {
          switch (keyType) {
            case "codestral":
              this.apiBase = "https://codestral.mistral.ai/v1/";
              break;
            case "mistral":
              this.apiBase = "https://api.mistral.ai/v1/";
              break;
          }

          this.openaiAdapter = this.createOpenAiAdapter();
        })
        .catch((err: any) => {});
    }
  }

  private static modelConversion: { [key: string]: string } = {
    "mistral-7b": "open-mistral-7b",
    "mistral-8x7b": "open-mixtral-8x7b",
  };
  protected _convertModelName(model: string): string {
    return Mistral.modelConversion[model] ?? model;
  }

  _convertArgs(options: any, messages: ChatMessage[]) {
    const finalOptions = super._convertArgs(options, messages);

    const lastMessage = finalOptions.messages[finalOptions.messages.length - 1];
    if (lastMessage?.role === "assistant") {
      (lastMessage as any).prefix = true;
    }

    return finalOptions;
  }

  supportsFim(): boolean {
    return true;
  }
}

export default Mistral;
