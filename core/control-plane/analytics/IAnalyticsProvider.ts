import { Analytics } from "@continuedev/config-types";

export interface AnalyticsMetadata {
  extensionVersion: string;
}

export interface ControlPlaneProxyInfo {
  workspaceId?: string;
  controlPlaneProxyUrl: string;
  workOsAccessToken?: string;
}

export interface IAnalyticsProvider {
  capture(event: string, properties: { [key: string]: any }): Promise<void>;
  setup(
    config: Analytics,
    uniqueId: string,
    controlPlaneProxyInfo?: ControlPlaneProxyInfo,
  ): Promise<void>;
  shutdown(): Promise<void>;
}
