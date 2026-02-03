import { getControlPlaneEnv } from "../../control-plane/env.js";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";
import { assertLocalhostUrl } from "@continuedev/fetch";

class ContinueProxyContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "continue-proxy",
    displayTitle: "Continue Proxy",
    description: "Retrieve a context item from a Continue for Teams add-on",
    type: "submenu",
  };

  workOsAccessToken: string | undefined = undefined;

  override get description(): ContextProviderDescription {
    return {
      title:
        this.options.title || ContinueProxyContextProvider.description.title,
      displayTitle:
        this.options.displayTitle ||
        this.options.name ||
        ContinueProxyContextProvider.description.displayTitle,
      description:
        this.options.description ||
        ContinueProxyContextProvider.description.description,
      type: this.options.type || ContinueProxyContextProvider.description.type,
    };
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const env = await getControlPlaneEnv(args.ide.getIdeSettings());
    const listUrl = new URL(
      `/proxy/context/${this.options.id}/list`,
      env.CONTROL_PLANE_URL,
    );
    assertLocalhostUrl(listUrl, "context-proxy");
    const response = await args.fetch(listUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.workOsAccessToken}`,
      },
    });
    const data = await response.json();
    return data.items;
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const env = await getControlPlaneEnv(extras.ide.getIdeSettings());
    const retrieveUrl = new URL(
      `/proxy/context/${this.options.id}/retrieve`,
      env.CONTROL_PLANE_URL,
    );
    assertLocalhostUrl(retrieveUrl, "context-proxy");
    const response = await extras.fetch(retrieveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.workOsAccessToken}`,
      },
      body: JSON.stringify({
        query: query || "",
        fullInput: extras.fullInput,
      }),
    });

    const items: any = await response.json();
    return items;
  }
}

export default ContinueProxyContextProvider;
