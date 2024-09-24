import { Analytics } from "@continuedev/config-types";
import fetch from "node-fetch";
import { IAnalyticsProvider } from "./IAnalyticsProvider.js";
import { ControlPlaneProvider } from "../provider";

export default class ContinueProxyAnalyticsProvider
  implements IAnalyticsProvider {
  uniqueId?: string;
  controlPlaneProvider: ControlPlaneProvider | undefined;

  async capture(
    event: string,
    properties: { [key: string]: any },
  ): Promise<void> {
    const url = new URL(
      `proxy/analytics/${this.controlPlaneProvider!.proxy?.workspaceId}/capture`,
      this.controlPlaneProvider!.proxy?.url,
    ).toString();
    fetch(url, {
      method: "POST",
      body: JSON.stringify({
        event,
        properties,
        uniqueId: this.uniqueId,
      }),
      headers: {
        Authorization: `Bearer ${await this.controlPlaneProvider!.client.getAccessToken()}`,
      },
    });
  }

  async setup(
    config: Analytics,
    uniqueId: string,
    controlPlaneProvider: ControlPlaneProvider,
  ): Promise<void> {
    this.uniqueId = uniqueId;
    this.controlPlaneProvider = controlPlaneProvider;
  }

  async shutdown(): Promise<void> {
  }
}
