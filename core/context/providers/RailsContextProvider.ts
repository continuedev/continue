import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";
import { fileTrees } from "./FileTreeContextProvider.js";

class RailsContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "rails",
    displayTitle: "Rails Project",
    description: "Gems Schema File Info",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const workspaceDirs = await extras.ide.getWorkspaceDirs();

    const rubyversionContent = await extras.ide.readFile(
      workspaceDirs + "/.ruby-version",
    );

    const gemfileContent = await extras.ide.readFile(
      workspaceDirs + "/Gemfile",
    );

    const schemaContent = await extras.ide.readFile(
      workspaceDirs + "/db/schema.rb",
    );

    const fTrees = await fileTrees(extras);
    const trees = fTrees.join("\n\n");

    const content = `This is a rails app. \nRuby:\n ${rubyversionContent} \nGemfile:\n ${gemfileContent} \nSchema:\n ${schemaContent} \nFile tree:\n ${trees}.`;

    return [
      {
        description: "Rails Application",
        content: content,
        name: "rails",
      },
    ];
  }
}

export default RailsContextProvider;
