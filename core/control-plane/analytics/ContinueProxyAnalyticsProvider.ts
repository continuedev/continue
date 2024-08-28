import { Analytics } from "@continuedev/config-types";
import fetch from "node-fetch";
import { CONTROL_PLANE_URL } from "../client.js";
import { IAnalyticsProvider } from "./IAnalyticsProvider.js";

export default class ContinueProxyAnalyticsProvider
  implements IAnalyticsProvider
{
  uniqueId?: string;
  workspaceId?: string;

  async capture(
    event: string,
    properties: { [key: string]: any },
  ): Promise<void> {
    fetch(new URL(`/proxy/analytics/${this.workspaceId}`, CONTROL_PLANE_URL), {
      method: "POST",
      body: JSON.stringify({
        event,
        properties,
        uniqueId: this.uniqueId,
      }),
    });
  }

  async setup(
    config: Analytics,
    uniqueId: string,
    workspaceId?: string,
  ): Promise<void> {
    this.uniqueId = uniqueId;
    this.workspaceId = workspaceId;
  }

  async shutdown(): Promise<void> {}
}
