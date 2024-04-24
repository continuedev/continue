//os.platform()
//os.arch()

import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";
import os from "os";

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
