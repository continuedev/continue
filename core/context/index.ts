import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  IContextProvider,
  LoadSubmenuItemsArgs,
} from "..";
export abstract class BaseContextProvider implements IContextProvider {
  options: { [key: string]: any };

  constructor(options: { [key: string]: any }) {
    this.options = options;
  }

  static description: ContextProviderDescription;

  get description(): ContextProviderDescription {
    return (this.constructor as any).description;
  }

  // Maybe just include the chat message in here. Should never have to go back to the context provider once you have the information.
  abstract getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]>;

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    return [];
  }
}
