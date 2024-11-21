import { ConfigHandler } from "core/config/ConfigHandler";
import Ollama from "core/llm/llms/Ollama";
import { GlobalContext } from "core/util/GlobalContext";

import type { ILLM } from "core";

export class TabAutocompleteModel {
  private _llm: ILLM | undefined;
  private defaultTag = "qwen2.5-coder:1.5b";
  private globalContext: GlobalContext = new GlobalContext();

  constructor(private configHandler: ConfigHandler) {}

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
        return undefined;
      }
    } catch (e) {
      return undefined;
    }

    return llm;
  }

  async get() {
    if (!this._llm) {
      const config = await this.configHandler.loadConfig();
      if (config.tabAutocompleteModels?.length) {
        const selected = this.globalContext.get("selectedTabAutocompleteModel");
        if (selected) {
          this._llm =
            config.tabAutocompleteModels?.find(
              (model) => model.title === selected,
            ) ?? config.tabAutocompleteModels?.[0];
        } else {
          if (config.tabAutocompleteModels[0].title) {
            this.globalContext.update(
              "selectedTabAutocompleteModel",
              config.tabAutocompleteModels[0].title,
            );
          }
          this._llm = config.tabAutocompleteModels[0];
        }
      } else {
        this._llm = await this.getDefaultTabAutocompleteModel();
      }
    }

    return this._llm;
  }
}
