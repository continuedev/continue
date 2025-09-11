import type {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  CustomContextProvider,
  IContextProvider,
  LoadSubmenuItemsArgs,
} from "../../";

class CustomContextProviderClass implements IContextProvider {
  constructor(private custom: CustomContextProvider) {}

  get description(): ContextProviderDescription {
    return {
      title: this.custom.title,
      displayTitle: this.custom.displayTitle ?? this.custom.title,
      description: this.custom.description ?? "",
      type: this.custom.type ?? "normal",
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
    return this.custom.loadSubmenuItems?.(args) ?? [];
  }

  get deprecationMessage() {
    return null;
  }
}

export default CustomContextProviderClass;
