import {
  ContextItem,
  ContextProviderDescription,
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
    fullInput: string
  ): Promise<ContextItem[]> {
    return await this.custom.getContextItems(query);
  }
  async load(): Promise<void> {}
}

export default CustomContextProviderClass;
