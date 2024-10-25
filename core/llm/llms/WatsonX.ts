import {
  ChatMessage,
  CompletionOptions,
  LLMOptions,
  ModelProvider,
} from "../../index.js";
import { stripImages } from "../images.js";
import { BaseLLM } from "../index.js";
import { streamResponse } from "../stream.js";
const watsonxConfig = {
  accessToken: {
    expiration: 0,
    token: "",
  },
};
class WatsonX extends BaseLLM {

  constructor(options: LLMOptions) {
    super(options);
  }
  async getBearerToken(): Promise<{ token: string; expiration: number }> {
    if (
      this.watsonxFullUrl?.includes("cloud.ibm.com") ||
      this.watsonxUrl?.includes("cloud.ibm.com")
    ) {
      // watsonx SaaS
      const wxToken = await (
        await fetch(
          `https://iam.cloud.ibm.com/identity/token?apikey=${this.watsonxCreds}&grant_type=urn:ibm:params:oauth:grant-type:apikey`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
          },
        )
      ).json();
      return {
        token: wxToken["access_token"],
        expiration: wxToken["expiration"],
      };
    } else {
      // watsonx Software
      if (!this.watsonxCreds?.includes(":")) {
        // Using ZenApiKey auth
        return {
          token: this.watsonxCreds ?? "",
          expiration: -1,
        };
      } else {
        // Using username/password auth
        const userPass = this.watsonxCreds?.split(":");
        const wxToken = await (
          await fetch(`${this.watsonxUrl}/icp4d-api/v1/authorize`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              username: userPass[0],
              password: userPass[1],
            }),
          })
        ).json();
        const wxTokenExpiry = await (
          await fetch(`${this.watsonxUrl}/usermgmt/v1/user/tokenExpiry`, {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${wxToken["token"]}`,
            },
          })
        ).json();
        return {
          token: wxToken["token"],
          expiration: wxTokenExpiry["exp"],
        };
      }
    }
  }

  getWatsonxEndpoint(): string {
    return (
      this.watsonxFullUrl ??
      `${this.watsonxUrl}/ml/v1/text/generation_stream?version=${this.watsonxApiVersion}`
    );
  }

  static providerName: ModelProvider = "watsonx";

  protected _convertMessage(message: ChatMessage) {
    if (typeof message.content === "string") {
      return message;
    }

    const parts = message.content.map((part) => {
      const msg: any = {
        type: part.type,
        text: part.text,
      };
      if (part.type === "imageUrl") {
        msg.image_url = { ...part.imageUrl, detail: "low" };
        msg.type = "image_url";
      }
      return msg;
    });
    return {
      ...message,
      content: parts,
    };
  }

  protected _convertModelName(model: string): string {
    return model;
  }

  protected _convertArgs(options: any, messages: ChatMessage[]) {
    const finalOptions = {
      messages: messages.map(this._convertMessage),
      model: this._convertModelName(options.model),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
    };
    return finalOptions;
  }

  protected _getHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `${watsonxConfig.accessToken.expiration === -1 ? "ZenApiKey" : "Bearer"
        } ${watsonxConfig.accessToken.token}`,
    };
  }

  protected async _complete(
    prompt: string,
    options: CompletionOptions,
  ): Promise<string> {
    let completion = "";
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      options,
    )) {
      completion += chunk.content;
    }

    return completion;
  }

  protected async *_streamComplete(
    prompt: string,
    options: CompletionOptions,
  ): AsyncGenerator<string> {
    for await (const chunk of this._streamChat(
      [{ role: "user", content: prompt }],
      options,
    )) {
      yield stripImages(chunk.content);
    }
  }

  protected async *_streamChat(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatMessage> {
    var now = new Date().getTime() / 1000;
    if (
      watsonxConfig.accessToken === undefined ||
      now > watsonxConfig.accessToken.expiration ||
      watsonxConfig.accessToken.token === undefined
    ) {
      watsonxConfig.accessToken = await this.getBearerToken();
    } else {
      console.log(
        `Reusing token (expires in ${(watsonxConfig.accessToken.expiration - now) / 60
        } mins)`,
      );
    }
    if (watsonxConfig.accessToken.token === undefined) {
      throw new Error("Something went wrong. Check your credentials, please.");
    }

    const stopToken =
      this.watsonxStopToken ??
      (options.model?.includes("granite") ? "<|im_end|>" : undefined);
    const url = this.getWatsonxEndpoint();
    const headers = this._getHeaders();

    const parameters: any = {
      decoding_method: "greedy",
      max_new_tokens: options.maxTokens ?? 1024,
      min_new_tokens: 1,
      stop_sequences: stopToken ? [stopToken] : [],
      include_stop_sequence: false,
      repetition_penalty: 1,
    };
    if (!!options.temperature) {
      parameters.decoding_method = "sample";
      parameters.temperature = options.temperature;
      parameters.top_p = options.topP || 1.0;
      parameters.top_k = options.topK;
    }

    const payload: any = {
      input: messages[messages.length - 1].content,
      parameters: parameters,
    };
    if (!this.watsonxFullUrl) {
      payload.model_id = options.model;
      payload.project_id = this.watsonxProjectId;
    }

    var response = await this.fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok || response.body === null) {
      throw new Error(
        "Something went wrong. No response received, check your connection",
      );
    } else {
      for await (const value of streamResponse(response)) {
        const lines = value.split("\n");
        let generatedChunk = "";
        let generatedTextIndex = undefined;
        lines.forEach((el: string) => {
          // console.log(`${el}`);
          if (el.startsWith("id:")) {
            generatedTextIndex = parseInt(el.replace(/^id:\s+/, ""));
            if (isNaN(generatedTextIndex)) {
              console.error(`Unable to parse stream chunk ID: ${el}`);
            }
          } else if (el.startsWith("data:")) {
            const dataStr = el.replace(/^data:\s+/, "");
            try {
              const data = JSON.parse(dataStr);
              data.results.forEach((result: any) => {
                generatedChunk += result.generated_text || "";
              });
            } catch (e) {
              console.error(`Error parsing JSON string: ${dataStr}`, e);
            }
          }
        });
        yield {
          role: "assistant",
          content: generatedChunk,
        };
      }
    }
  }
}

export default WatsonX;
