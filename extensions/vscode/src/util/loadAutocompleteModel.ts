import { ILLM } from "core";
import { ConfigHandler } from "core/config/handler";
import Ollama from "core/llm/llms/Ollama";
import * as vscode from "vscode";

export class TabAutocompleteModel {
  private _llm: ILLM | undefined;
  private defaultTag: string = "starcoder:3b";
  private defaultTagName: string = "Starcoder 3b";

  private shownOllamaWarning: boolean = false;
  private shownDeepseekWarning: boolean = false;

  private configHandler: ConfigHandler;

  constructor(configHandler: ConfigHandler) {
    this.configHandler = configHandler;
  }

  clearLlm() {
    this._llm = undefined;
  }

  async getDefaultTabAutocompleteModel() {
    const llm = new Ollama({
      model: this.defaultTag,
    });

    try {
      const models = await llm.listModels();
      if (!models.includes(this.defaultTag)) {
        if (!this.shownDeepseekWarning) {
          vscode.window
            .showWarningMessage(
              `Your local Ollama instance doesn't yet have ${this.defaultTagName}. To download this model, run \`ollama run ${this.defaultTag}\` (recommended). If you'd like to use a custom model for tab autocomplete, learn more in the docs`,
              "Documentation",
              "Copy Command",
            )
            .then((value) => {
              if (value === "Documentation") {
                vscode.env.openExternal(
                  vscode.Uri.parse(
                    "https://continue.dev/docs/walkthroughs/tab-autocomplete",
                  ),
                );
              } else if (value === "Copy Command") {
                vscode.env.clipboard.writeText(`ollama run ${this.defaultTag}`);
              }
            });
          this.shownDeepseekWarning = true;
        }
        return undefined;
      }
    } catch (e) {
      if (!this.shownOllamaWarning) {
        vscode.window
          .showWarningMessage(
            "Continue failed to connect to Ollama, which is used by default for tab-autocomplete. If you haven't downloaded it yet, you can do so at https://ollama.ai (recommended). If you'd like to use a custom model for tab autocomplete, learn more in the docs",
            "Documentation",
          )
          .then((value) => {
            if (value === "Documentation") {
              vscode.env.openExternal(
                vscode.Uri.parse(
                  "https://continue.dev/docs/walkthroughs/tab-autocomplete",
                ),
              );
            }
          });
        this.shownOllamaWarning = true;
      }
      return undefined;
    }

    return llm;
  }

  async get() {
    if (!this._llm) {
      const config = await this.configHandler.loadConfig();
      if (config.tabAutocompleteModel) {
        this._llm = this.configHandler.setupLlm(config.tabAutocompleteModel);
      } else {
        this._llm = await this.getDefaultTabAutocompleteModel();
      }
    }

    return this._llm;
  }
}
