import { ConfigJson } from "@continuedev/config-types";
import fetch, { RequestInit, Response } from "node-fetch";

export interface ControlPlaneSessionInfo {
  accessToken: string;
  account: {
    label: string;
    id: string;
  };
}

export interface ControlPlaneWorkspace {
  id: string;
  name: string;
  settings: ConfigJson;
}

export interface ControlPlaneClient {
  url: string;
  proxyUrl: string;
  sessionInfoPromise: Promise<ControlPlaneSessionInfo | undefined>;
  userId: Promise<string | undefined>;

  getAccessToken(): Promise<string | undefined>;

  listWorkspaces(): Promise<ControlPlaneWorkspace[]>;

  getSettingsForWorkspace(workspaceId: string): Promise<ConfigJson>;
}

export class GenericControlPlaneClient implements ControlPlaneClient{
  constructor(
    readonly sessionInfoPromise: Promise<
      ControlPlaneSessionInfo | undefined
    >,
    readonly url: string,
    readonly proxyUrl: string,
  ) {
  }

  get userId(): Promise<string | undefined> {
    return this.sessionInfoPromise.then(
      (sessionInfo) => sessionInfo?.account.id,
    );
  }

  async getAccessToken(): Promise<string | undefined> {
    return (await this.sessionInfoPromise)?.accessToken;
  }

  public async listWorkspaces(): Promise<ControlPlaneWorkspace[]> {
    const userId = await this.userId;
    if (!userId) {
      return [];
    }

    try {
      const resp = await this.request("workspaces", {
        method: "GET",
      });
      return (await resp.json()) as any;
    } catch (e) {
      return [];
    }
  }

  async getSettingsForWorkspace(workspaceId: string): Promise<ConfigJson> {
    const userId = await this.userId;
    if (!userId) {
      throw new Error("No user id");
    }

    const resp = await this.request(`workspaces/${workspaceId}`, {
      method: "GET",
    });
    return ((await resp.json()) as any).settings;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("No access token");
    }
    const url = new URL(path, this.url).toString();
    const resp = await fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!resp.ok) {
      throw new Error(
        `Control plane request failed: ${resp.status} ${await resp.text()}`,
      );
    }

    return resp;
  }
}
