import { ChatCompletionCreateParams } from "openai/resources/index";

import { LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

class Saygm extends OpenAI {
  static providerName = "saygm";

  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://api.saygm.com/v1/",
    model: "gpt-5.4",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };

  protected modifyChatBody(
    body: ChatCompletionCreateParams,
  ): ChatCompletionCreateParams {
    const modified = super.modifyChatBody(body);
    if (
      modified.model === "gpt-5.6-sol" &&
      Array.isArray(modified.tools) &&
      modified.tools.length > 0
    ) {
      (
        modified as Omit<ChatCompletionCreateParams, "reasoning_effort"> & {
          reasoning_effort?: string;
        }
      ).reasoning_effort = "none";
    }
    return modified;
  }
}

export default Saygm;
