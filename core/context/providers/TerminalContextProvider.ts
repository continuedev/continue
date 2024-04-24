import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";

class TerminalContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "terminal",
    displayTitle: "Terminal",
    description: "Reference the contents of the terminal",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const content = await extras.ide.getTerminalContents();
    return [
      {
        description: "The contents of the terminal",
        content: `Current terminal contents:\n\n${content}`,
        name: "Terminal",
      },
    ];
  }
}

export default TerminalContextProvider;
