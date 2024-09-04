import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../";
import generateRepoMap from "../../util/repoMap";

class RepoMapContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "repo-map",
    displayTitle: "Repository Map",
    description: "List of files and signatures",
    type: "normal",
    dependsOnIndexing: true,
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    return [
      {
        name: "Repository Map",
        description: "Overview of the repository structure",
        content: await generateRepoMap(extras.llm, extras.ide),
      },
    ];
  }
}

export default RepoMapContextProvider;
