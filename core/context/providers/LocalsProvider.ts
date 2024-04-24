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
    const threadIndex = Number(query);
    const thread = (await extras.ide.getAvailableThreads()).find(
      (thread) => thread.id == threadIndex
    );
    const callStacksSources = await extras.ide.getTopLevelCallStackSources(
      threadIndex,
      this.options?.stackDepth || 3
    );
    const callStackContents = callStacksSources.reduce(
      (acc, source, index) =>
        acc + `\n\ncall stack ${index}\n` + "```\n" + source + "\n```",
      ""
    );
    return [
      {
        description: "The value, name and possibly type of the local variables",
        content:
          `This is a paused thread: ${thread?.name}\n` +
          `Current local variable contents: \n${localVariables}.\n` +
          `Current top level call stacks: ${callStackContents}`,
        name: "Locals",
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs
  ): Promise<ContextSubmenuItem[]> {
    const threads = await args.ide.getAvailableThreads();

    return threads.map((thread) => ({
      id: `${thread.id}`,
      title: thread.name,
      description: `${thread.id}`,
    }));
  }
}

export default LocalsProvider;
