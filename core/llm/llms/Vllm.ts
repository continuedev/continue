import { LLMOptions, ModelProvider } from "../../index.js";
import OpenAI from "./OpenAI.js";

class Vllm extends OpenAI {
  static providerName: ModelProvider = "vllm";
  constructor(options: LLMOptions) {
    super(options);
    this._setupCompletionOptions();
  }

  private _setupCompletionOptions() {
    this.fetch(this._getEndpoint("models"), {
      method: "GET",
      headers: this._getHeaders(),
    }).then(async (response) => {
      if (response.status !== 200) {
        console.warn(
          "Error calling vLLM /models endpoint: ",
          await response.text(),
        );
        return;
      }
      const json = await response.json();
      const data = json.data;
      this.model = data.id;
      this.contextLength = Number.parseInt(data.max_model_len);
    });
  }
}

export default Vllm;
