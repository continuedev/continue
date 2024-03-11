import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  CustomContextProvider,
  IContextProvider,
  LoadSubmenuItemsArgs,
} from "../..";

class CustomContextProviderClass implements IContextProvider {
  custom: CustomContextProvider;
  constructor(custom: CustomContextProvider) {
    this.custom = custom;
  }

  get description(): ContextProviderDescription {
    return {
      title: this.custom.title,
      displayTitle: this.custom.displayTitle || this.custom.title,
      description: this.custom.description || "",
      type: this.custom.type || "normal",
      renderInlineAs: this.custom.renderInlineAs,
    };
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    return await this.custom.getContextItems(query, extras);
  }

  async loadSubmenuItems(args: LoadSubmenuItemsArgs) {
    return this.custom.loadSubmenuItems?.(args) || [];
  }
}

export default CustomContextProviderClass;
