import { LLMOptions } from "../../index.js";

import OpenAI from "./OpenAI.js";

class Vllm extends OpenAI {
  static providerName = "vllm";
  constructor(options: LLMOptions) {
    super(options);

    if (options.model === "AUTODETECT") {
      this._setupCompletionOptions();
    }
  }

  private _setupCompletionOptions() {
    this.fetch(this._getEndpoint("models"), {
      method: "GET",
      headers: this._getHeaders(),
    })
      .then(async (response) => {
        if (response.status !== 200) {
          console.warn(
            "Error calling vLLM /models endpoint: ",
            await response.text(),
          );
          return;
        }
        const json = await response.json();
        const data = json.data[0];
        this.model = data.id;
        this.contextLength = Number.parseInt(data.max_model_len);
      })
      .catch((e) => {
        console.log(`Failed to list models for vLLM: ${e.message}`);
      });
  }
}

export default Vllm;
