// BAS Customization
import { CompletionOptions, LLMOptions, ModelProvider } from "core/index.js";
import { BaseLLM } from "core/llm/index.js";

import * as vscode from "vscode";
import { ContinueGenie } from "./AICoreGenie/genie";
import { BasToolkit } from "@sap-devx/app-studio-toolkit-types";

const basAPI: BasToolkit = vscode.extensions.getExtension("SAPOSS.app-studio-toolkit")?.exports;

class AICore extends BaseLLM {
  static providerName: ModelProvider = "aicore";
  static defaultOptions: Partial<LLMOptions> = {
    model: "gpt-4o-mini",
  };

  constructor(options: LLMOptions) {
    basAPI.getExtensionAPI<any>("SAPSE.joule").then(async (jouleAPI: any) => {
      // register SampleGenies
      const continueGenie = new ContinueGenie();
      await jouleAPI.registerGenie(continueGenie);
    });

    super(options);
  }

  async listModels(): Promise<string[]> {
    return ["gpt-4o-mini"];
  }

  protected async *_streamComplete(prompt: string, options: CompletionOptions): AsyncGenerator<string> {
    try {
      const genie = await vscode.commands.executeCommand("joule.getGenie", "auto-completion-genie");
      if (!genie) {
        console.debug("joule.getGenie - Not found the specified auto-completion-genie genie.");
        return;
      }
      const serviceProxy = await (genie as any).getServiceProxy();
      const completionPayload = await serviceProxy.buildPayload(genie, prompt, []);
      const response = await serviceProxy.requestCompletion(genie, completionPayload);

      let res = response.content;
      if (res.includes("<COMPLETION>") && res.includes("</COMPLETION>")) {
        res = res.slice("<COMPLETION>".length, res.length - "</COMPLETION>".length);
        yield res;
      }
    } catch (error) {
      console.error("Error fetching response from AI.core", error);
      process.exit(1);
    }
  }
}

export default AICore;
