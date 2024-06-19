import { LLMOptions, ModelProvider } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";
import OpenAI from "./OpenAI.js";

class Deepseek extends OpenAI {
  static providerName: ModelProvider = "deepseek";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.deepseek.com/",
    model: "deepseek-coder",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };
  protected maxStopWords: number | undefined = 4;
}

export default Deepseek;
