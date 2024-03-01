import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../..";

class LocalsProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "locals",
    displayTitle: "Locals",
    description: "Reference the contents of the local variables",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    // Assuming that the query is a number
    const localVariables = await extras.ide.getDebugLocals(Number(query));
    const callStacksSources = await extras.ide.getTopLevelCallStackSources(
      Number(query),
      3
    );
    const callStackContents = callStacksSources.reduce(
      (acc, source, index) =>
        acc + `\n\ncall stack ${index}\n` + "```\n" + source + "\n```", ""
    );
    return [
      {
        description: "The value, name and possibly type of the local variables",
        content: `Current local variable contents:\n\n${localVariables}.\n\n Current top level call stacks: \n\n ${callStackContents}`,
        name: "Locals",
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs
  ): Promise<ContextSubmenuItem[]> {
    const threads = await args.ide.getAvailableThreads();

    return threads.map((thread, threadIndex) => {
      const [threadId, threadName] = thread
        .split(",")
        .map((str) => str.trimEnd());
      return {
        id: `${threadIndex}`,
        title: threadName,
        description: threadId,
      };
    });
  }
}

export default LocalsProvider;
