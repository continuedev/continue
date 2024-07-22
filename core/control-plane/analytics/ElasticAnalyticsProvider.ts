import { Analytics } from "@continuedev/config-types";
import { IAnalyticsProvider } from "./IAnalyticsProvider";

export default class ElasticAnalyticsProvider implements IAnalyticsProvider {
  async capture(
    event: string,
    properties: { [key: string]: any },
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async setup(config: Analytics, uniqueId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async shutdown(): Promise<void> {}
}
