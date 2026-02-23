import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  FetchFunction,
} from "../..";
import { getHeaders } from "../../continueServer/stubs/headers";
import { TRIAL_PROXY_URL } from "../../control-plane/client";

export const fetchSearchResults = async (
  query: string,
  n: number,
  fetchFn: FetchFunction,
): Promise<ContextItem[]> => {
  const resp = await fetchFn(WebContextProvider.ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await getHeaders()),
    },
    body: JSON.stringify({
      query,
      n,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch web context: ${text}`);
  }
  return await resp.json();
};

export default class WebContextProvider extends BaseContextProvider {
  public static ENDPOINT = new URL("web", TRIAL_PROXY_URL);
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
    return await fetchSearchResults(
      extras.fullInput,
      this.options.n ?? WebContextProvider.DEFAULT_N,
      extras.fetch,
    );
  }
}
