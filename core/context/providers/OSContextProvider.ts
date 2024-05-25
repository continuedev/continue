//os.platform()
//os.arch()

import os from "os";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

class OSContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "OS",
    displayTitle: "OS",
    description: "OS and CPU Information.",
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
        description: "Your OS and CPU",
        content: `I am running ${platform} on ${cpu}.`,
        name: "OS",
      },
    ];
  }
}

export default OSContextProvider;
