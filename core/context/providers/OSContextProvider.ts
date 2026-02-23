import os from "os";

import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

class OSContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "os",
    displayTitle: "Operating System",
    description: "Operating system and CPU Information.",
    type: "normal",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const cpu = os.arch();
    const platform = os.platform();
    return [
      {
        description: "Your operating system and CPU",
        content: `I am running ${
          platform === "win32" ? "Windows" : platform
        } on ${cpu}.`,
        name: "Operating System",
      },
    ];
  }
}

export default OSContextProvider;
