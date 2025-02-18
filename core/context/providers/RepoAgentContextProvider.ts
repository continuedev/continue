// @ts-nocheck
import { AIMessage } from "@langchain/core/messages";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";
import { initRepoAgent } from "./RepoAgentImpl.js";

// Add context provider support
class RepoAgentContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "repository_agent",
    displayTitle: "Repository Agent",
    description: "Ask questions about the codebase",
    type: "normal",
    renderInlineAs: "",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    try {
      const agent = await initRepoAgent(extras.ide, extras.llm.title);
      const result = await agent.invoke(extras.fullInput);

      // Convert agent responses to context items
      return result.messages
        .filter((msg) => msg instanceof AIMessage)
        .map((msg) => ({
          content: msg.content,
          name: "Repository Agent",
          description: "Response from the repository agent",
          icon: "🤖",
        }));
    } catch (error) {
      console.error("Error in repo agent:", error);
      return [{
        content: `Error getting response from repository agent: ${error}`,
        name: "Repository Agent Error",
        description: "An error occurred",
        icon: "⚠️",
      }];
    }
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    // Repository agent doesn't have submenu items
    return [];
  }
}

export default RepoAgentContextProvider; 