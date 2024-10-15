import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";
import { getHeaders } from "../../continueServer/stubs/headers";
import { TRIAL_PROXY_URL } from "../../control-plane/client";

export default class WebContextProvider extends BaseContextProvider {
  private static ENDPOINT = new URL("web", TRIAL_PROXY_URL);
  private static DEFAULT_N = 6;

  static description: ContextProviderDescription = {
    title: "web",
    displayTitle: "Web",
    description: "Search the web",
    type: "normal",
    renderInlineAs: "",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const resp = await extras.fetch(WebContextProvider.ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getHeaders()),
      },
      body: JSON.stringify({
        query: extras.fullInput,
        n: this.options.n ?? WebContextProvider.DEFAULT_N,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Failed to fetch web context: ${text}`);
    }
    const json = await resp.json();
    return json;
  }
}
