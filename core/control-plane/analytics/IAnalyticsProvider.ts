import { Analytics } from "@continuedev/config-types";

export interface AnalyticsMetadata {
  extensionVersion: string;
}

export interface IAnalyticsProvider {
  capture(event: string, properties: { [key: string]: any }): Promise<void>;
  setup(
    config: Analytics,
    uniqueId: string,
    workspaceId?: string,
  ): Promise<void>;
  shutdown(): Promise<void>;
}
