import { LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

class GeekAI extends OpenAI {
  static providerName = "geekai";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://geekai.dev/api/v1/",
    model: "gpt-4o-mini",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };
}

export default GeekAI;