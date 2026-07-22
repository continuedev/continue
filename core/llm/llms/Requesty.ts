import { LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

class Requesty extends OpenAI {
  static providerName = "requesty";
  protected supportsReasoningField = true;
  protected supportsReasoningDetailsField = true;
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://router.requesty.ai/v1/",
    model: "openai/gpt-4o-mini",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };
}

export default Requesty;
