import { v4 as uuidv4 } from "uuid";
import {
  ControlPlaneClient,
  ControlPlaneSessionInfo, GenericControlPlaneClient,
} from "./client";
import { IdeSettings } from "../index";

export interface ControlPlaneProxyInfo {
  workspaceId?: string;
  url: string;
  workOsAccessToken?: string;
}

export enum ControlPlaneProviderName {
  Continue = "continue",
  Generic = "generic",
}

export interface ControlPlaneProvider {
  // Client for the control plane provider
  client: ControlPlaneClient;

  // Name of the provider
  name: ControlPlaneProviderName;

  // Proxy info for the control plane client
  proxy: ControlPlaneProxyInfo | undefined;

  // Get the auth URL for the token page
  getAuthUrlForTokenPage(): Promise<string>;

  // Create a new client for the control plane provider
  newClient(sessionInfoPromise: Promise<ControlPlaneSessionInfo | undefined>): ControlPlaneClient;

  // Set the proxy for the control plane client
  setProxy(workspaceId: string | undefined, url: string | undefined): void;
}

export class GenericControlPlaneProvider implements ControlPlaneProvider{
  name: ControlPlaneProviderName = ControlPlaneProviderName.Generic;

  client: ControlPlaneClient;
  proxy: { url: string; workspaceId: string | undefined; } | undefined;

  // Provider client params for the control plane provider from IDE settings
  params = {
    controlPlane: {
      url: "",
      proxyUrl: "",
    },
    auth: {
      url: "",
      redirectUri: "",
      clientId: "",
    }
  };

  constructor(
    sessionInfoPromise: Promise<ControlPlaneSessionInfo | undefined>,
    params?: { [key: string]: string },
  ) {
    this.client = this.newClient(sessionInfoPromise);
    this.params = (params || this.params) as any;
  }

  get clientUrl(): string {
    return process.env.CONTROL_PLANE_ENV === "local"
      ? "http://localhost:3001/"
      : this.params.controlPlane.url;
  }

  get clientProxyUrl(): string {
    return process.env.CONTROL_PLANE_ENV === "local"
      ? "http://localhost:3001/proxy"
      : this.params.controlPlane.proxyUrl;
  }

  newClient(sessionInfoPromise: Promise<ControlPlaneSessionInfo | undefined>): ControlPlaneClient {
    return new GenericControlPlaneClient(sessionInfoPromise, this.clientUrl, this.clientProxyUrl);
  }

  // Set the proxy for the control plane client
  setProxy(workspaceId: string | undefined, url: string | undefined) {

    url = url || this.client.proxyUrl;

    if (!url.endsWith("/")) {
      url += "/";
    }

    this.proxy = {
      workspaceId,
      url,
    };
  }

  async getAuthUrlForTokenPage(): Promise<string> {
    const url = new URL(this.params.auth.url);
    const params = {
      response_type: "code",
      client_id: this.params.auth.clientId,
      redirect_uri: this.params.auth.redirectUri,
      state: uuidv4(),
      provider: "authkit",
    };
    Object.keys(params).forEach((key) =>
      url.searchParams.append(key, params[key as keyof typeof params]),
    );
    return url.toString();
  }
}


class ContinueControlPlaneProvider extends GenericControlPlaneProvider {
  name = ControlPlaneProviderName.Continue;

  params = {
    controlPlane: {
      url: "https://control-plane-api-service-i3dqylpbqa-uc.a.run.app/",
      proxyUrl: "https://control-plane-proxy.continue.dev/",
    },
    auth: {
      url: "https://api.workos.com/user_management/authorize",
      redirectUri: "https://app.continue.dev/tokens/callback",
      clientId: "client_01J0FW6XN8N2XJAECF7NE0Y65J",
    }
  };
}


// Factory for creating control plane providers
export class ControlPlaneProviderFactory {

  // Create a new control plane provider based on the ide settings
  static async createProvider(
    ideSettingsPromise: Promise<IdeSettings>,
    sessionInfoPromise: Promise<ControlPlaneSessionInfo | undefined>,
  ): Promise<ControlPlaneProvider> {

    const ideSettings = await ideSettingsPromise;
    const providerName = ideSettings.controlPlaneProviderName
      ? ideSettings?.controlPlaneProviderName
      : ControlPlaneProviderName.Continue;

    if (providerName === ControlPlaneProviderName.Continue) {
      return new ContinueControlPlaneProvider(sessionInfoPromise);
    }
    if (providerName === ControlPlaneProviderName.Generic) {
      return new GenericControlPlaneProvider(
        sessionInfoPromise,
        ideSettings.controlPlaneProviderParams
      );
    }

    throw new Error("Unknown control plane provider");
  };
}
