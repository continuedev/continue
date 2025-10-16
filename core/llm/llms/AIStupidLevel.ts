import { LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

class AIStupidLevel extends OpenAI {
  static providerName = "aistupidlevel";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://aistupidlevel.info/v1/",
    model: "auto-coding",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };
}

export default AIStupidLevel;
