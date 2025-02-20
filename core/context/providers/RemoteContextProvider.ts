import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

// Formerly "http"
class RemoteServerContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "remote",
    displayTitle: "Remote Server",
    description: "Retrieve a context item from a custom server",
    type: "normal",
    renderInlineAs: "",
  };

  override get description(): ContextProviderDescription {
    return {
      title: this.options.title || "remote",
      displayTitle:
        this.options.displayTitle ||
        RemoteServerContextProvider.description.displayTitle,
      description:
        this.options.description ||
        "Retrieve a context item from a custom server",
      type: "normal",
      renderInlineAs:
        this.options.renderInlineAs ||
        RemoteServerContextProvider.description.renderInlineAs,
    };
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const response = await extras.fetch(new URL(this.options.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query || "",
        fullInput: extras.fullInput,
        options: this.options.options,
      }),
    });

    const json = await response.json();

    try {
      const createContextItem = (item: any) => ({
        description:
          item.description ?? `${this.options.displayTitle} context item`,
        content: item.content ?? "",
        name: item.name ?? this.options.title ?? "Remote",
      });

      return Array.isArray(json)
        ? json.map(createContextItem)
        : [createContextItem(json)];
    } catch (e) {
      console.warn(
        `Failed to parse response from custom remote server context provider ${this.options.displayTitle}\nError:\n${e}\nResponse from server:\n`,
        json,
      );
      return [];
    }
  }
}

export default RemoteServerContextProvider;
