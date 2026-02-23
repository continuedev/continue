import { Analytics } from "@continuedev/config-types";
import fetch from "node-fetch";

import { ControlPlaneClient } from "../client.js";

import {
  ControlPlaneProxyInfo,
  IAnalyticsProvider,
} from "./IAnalyticsProvider.js";

export default class ContinueProxyAnalyticsProvider
  implements IAnalyticsProvider
{
  uniqueId?: string;
  controlPlaneProxyInfo?: ControlPlaneProxyInfo;

  controlPlaneClient?: ControlPlaneClient;

  async capture(
    event: string,
    properties: { [key: string]: any },
  ): Promise<void> {
    if (!this.controlPlaneProxyInfo?.workspaceId) {
      return;
    }

    const url = new URL(
      `proxy/analytics/${this.controlPlaneProxyInfo.workspaceId}/capture`,
      this.controlPlaneProxyInfo?.controlPlaneProxyUrl,
    ).toString();
    void fetch(url, {
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
    controlPlaneProxyInfo?: ControlPlaneProxyInfo,
  ): Promise<void> {
    this.uniqueId = uniqueId;
    this.controlPlaneProxyInfo = controlPlaneProxyInfo;
  }

  async shutdown(): Promise<void> {}
}
