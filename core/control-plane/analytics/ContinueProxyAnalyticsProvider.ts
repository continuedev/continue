import { Analytics } from "@continuedev/config-types";
import fetch from "node-fetch";
import { CONTROL_PLANE_URL, ControlPlaneClient } from "../client.js";
import { IAnalyticsProvider } from "./IAnalyticsProvider.js";

export default class ContinueProxyAnalyticsProvider
  implements IAnalyticsProvider
{
  uniqueId?: string;
  workspaceId?: string;

  controlPlaneClient?: ControlPlaneClient;

  async capture(
    event: string,
    properties: { [key: string]: any },
  ): Promise<void> {
    const url = new URL(
      `proxy/analytics/${this.workspaceId}/capture`,
      CONTROL_PLANE_URL,
    ).toString();
    fetch(url, {
      method: "POST",
      body: JSON.stringify({
        event,
        properties,
        uniqueId: this.uniqueId,
      }),
      headers: {
        Authorization: `Bearer ${await this.controlPlaneClient?.getAccessToken()}`,
      },
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
