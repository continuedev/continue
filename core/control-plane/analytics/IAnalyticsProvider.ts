import { Analytics } from "@continuedev/config-types";
import { ControlPlaneProvider } from "../provider";

export interface AnalyticsMetadata {
  extensionVersion: string;
}

export interface IAnalyticsProvider {
  capture(event: string, properties: { [key: string]: any }): Promise<void>;

  setup(
    config: Analytics,
    uniqueId: string,
    controlPlaneProvider: ControlPlaneProvider,
  ): Promise<void>;

  shutdown(): Promise<void>;
}
