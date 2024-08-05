import { Analytics } from "@continuedev/config-types";
import net from "node:net";
import { IAnalyticsProvider } from "./IAnalyticsProvider.js";

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

  async setup(config: Analytics, uniqueId: string): Promise<void> {
    if (!config.url) {
      throw new Error("Missing url in analytics config");
    }
    const url = new URL(config.url);
    this.host = url.hostname;
    this.port = parseInt(url.port);
    this.uniqueId = uniqueId;
  }

  async shutdown(): Promise<void> {}
}
