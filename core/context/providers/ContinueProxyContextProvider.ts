import { controlPlaneEnv } from "../../control-plane/env.js";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

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
    const response = await args.fetch(
      new URL(
        `/proxy/context/${this.options.id}/list`,
        controlPlaneEnv.CONTROL_PLANE_URL,
      ),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.workOsAccessToken}`,
        },
      },
    );
    const data = await response.json();
    return data.items;
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const response = await extras.fetch(
      new URL(
        `/proxy/context/${this.options.id}/retrieve`,
        controlPlaneEnv.CONTROL_PLANE_URL,
      ),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.workOsAccessToken}`,
        },
        body: JSON.stringify({
          query: query || "",
          fullInput: extras.fullInput,
        }),
      },
    );

    const items: any = await response.json();
    return items;
  }
}

export default ContinueProxyContextProvider;
