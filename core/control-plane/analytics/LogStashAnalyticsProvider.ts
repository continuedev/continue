import net from "node:net";

import { Analytics } from "@continuedev/config-types";

import {
  ControlPlaneProxyInfo,
  IAnalyticsProvider,
} from "./IAnalyticsProvider.js";

export default class LogStashAnalyticsProvider implements IAnalyticsProvider {
  private host?: string;
  private port?: number;
  private uniqueId?: string;

  async capture(
    event: string,
    properties: { [key: string]: any },
  ): Promise<void> {
    if (this.host === undefined || this.port === undefined) {
      console.warn("LogStashAnalyticsProvider not set up yet.");
    }

    const payload = {
      event,
      properties,
      uniqueId: this.uniqueId,
    };
    const client = new net.Socket();

    client.connect(this.port!, this.host!, () => {
      client.write(JSON.stringify(payload));
      client.end();
    });
  }

  async setup(
    config: Analytics,
    uniqueId: string,
    controlPlaneProxyInfo?: ControlPlaneProxyInfo,
  ): Promise<void> {
    if (!config.url) {
      console.warn("LogStashAnalyticsProvider is missing a URL");
      return;
    }
    const url = new URL(config.url);
    this.host = url.hostname;
    this.port = parseInt(url.port);
    this.uniqueId = uniqueId;
  }

  async shutdown(): Promise<void> {}
}
