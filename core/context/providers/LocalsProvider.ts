import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";

class LocalsProvider extends BaseContextProvider {

  static description: ContextProviderDescription = {
    title: "locals",
    displayTitle: "Locals",
    description: "Reference the contents of the local variables",
    type: "normal",
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    const content = await extras.ide.getDebugLocals();
    return [
      {
        description: "The value, name and possibly type of the local variables",
        content: `Current local variable contents:\n\n${content}`,
        name: "Locals",
      },
    ];
  }
}

export default LocalsProvider