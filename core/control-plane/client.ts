import fetch, { RequestInit, Response } from "node-fetch";
import { ModelDescription } from "..";
import { ControlPlaneSettings } from "./schema";

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
  settings: ControlPlaneSettings;
}

export interface ControlPlaneModelDescription extends ModelDescription {}

// export const CONTROL_PLANE_URL = "http://localhost:3001";
export const CONTROL_PLANE_URL =
  "https://control-plane-api-service-i3dqylpbqa-uc.a.run.app";

export class ControlPlaneClient {
  private static URL = CONTROL_PLANE_URL;
  private static ACCESS_TOKEN_VALID_FOR_MS = 1000 * 60 * 5; // 5 minutes

  private lastAccessTokenRefresh = 0;

  constructor(
    private readonly sessionInfoPromise: Promise<
      ControlPlaneSessionInfo | undefined
    >,
  ) {}

  get userId(): Promise<string | undefined> {
    return this.sessionInfoPromise.then(
      (sessionInfo) => sessionInfo?.account.id,
    );
  }

  private async getAccessToken(): Promise<string | undefined> {
    return (await this.sessionInfoPromise)?.accessToken;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("No access token");
    }
    const resp = await fetch(new URL(path, ControlPlaneClient.URL).toString(), {
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

  public async listWorkspaces(): Promise<ControlPlaneWorkspace[]> {
    const userId = await this.userId;
    if (!userId) {
      return [];
    }

    const resp = await this.request(`/workspaces`, {
      method: "GET",
    });
    return (await resp.json()) as any;
  }

  async getSettingsForWorkspace(
    workspaceId: string,
  ): Promise<ControlPlaneSettings> {
    const userId = await this.userId;
    if (!userId) {
      throw new Error("No user id");
    }

    const resp = await this.request(`/workspaces/${workspaceId}`, {
      method: "GET",
    });
    return ((await resp.json()) as any).settings;
  }
}
