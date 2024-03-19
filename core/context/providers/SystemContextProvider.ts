//os.platform()
//os.arch()

import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";
import os from "os";

class SystemContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "system",
    displayTitle: "System",
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
        content: `I am running a ${cpu} on ${platform}`,
        name: "System Information",
      },
    ];
  }
}

export default SystemContextProvider;
