import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

class HttpContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "http",
    displayTitle: "HTTP",
    description: "Retrieve a context item from a custom server",
    type: "normal",
    renderInlineAs: "",
  };

  override get description(): ContextProviderDescription {
    return {
      title: this.options.title || "http",
      displayTitle: this.options.displayTitle || "HTTP",
      description:
        this.options.description ||
        "Retrieve a context item from a custom server",
      type: "normal",
      renderInlineAs:
        this.options.renderInlineAs ||
        HttpContextProvider.description.renderInlineAs,
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
        ...(this.options.headers || {}),
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
        description: item.description ?? "HTTP Context Item",
        content: item.content ?? "",
        name: item.name ?? this.options.title ?? "HTTP",
      });

      return Array.isArray(json)
        ? json.map(createContextItem)
        : [createContextItem(json)];
    } catch (e) {
      console.warn(
        `Failed to parse response from custom HTTP context provider.\nError:\n${e}\nResponse from server:\n`,
        json,
      );
      return [];
    }
  }
}

export default HttpContextProvider;
