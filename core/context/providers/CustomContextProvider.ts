import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  CustomContextProvider,
  IContextProvider,
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
      dynamic: true,
      requiresQuery: false,
    };
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    return await this.custom.getContextItems(query, extras);
  }
  async load(): Promise<void> {}
}

export default CustomContextProviderClass;
