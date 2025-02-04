import { ConfigJson } from "@continuedev/config-types";
import fetch, { RequestInit, Response } from "node-fetch";

import { IdeSettings, ModelDescription } from "../index.js";

import {
  AssistantUnrolled,
  ConfigResult,
  FQSN,
  FullSlug,
  SecretResult,
} from "@continuedev/config-yaml";
import { getControlPlaneEnv } from "./env.js";

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

export interface ControlPlaneModelDescription extends ModelDescription {}

export const TRIAL_PROXY_URL =
  "https://proxy-server-blue-l6vsfbzhba-uw.a.run.app";

export class ControlPlaneClient {
  private static ACCESS_TOKEN_VALID_FOR_MS = 1000 * 60 * 5; // 5 minutes

  private lastAccessTokenRefresh = 0;

  constructor(
    private readonly sessionInfoPromise: Promise<
      ControlPlaneSessionInfo | undefined
    >,
    private readonly ideSettingsPromise: Promise<IdeSettings>,
  ) {}

  async resolveFQSNs(fqsns: FQSN[]): Promise<(SecretResult | undefined)[]> {
    const userId = await this.userId;
    if (!userId) {
      throw new Error("No user id");
    }

    const resp = await this.request("ide/sync-secrets", {
      method: "POST",
      body: JSON.stringify({ fqsns }),
    });
    return (await resp.json()) as any;
  }

  get userId(): Promise<string | undefined> {
    return this.sessionInfoPromise.then(
      (sessionInfo) => sessionInfo?.account.id,
    );
  }

  async getAccessToken(): Promise<string | undefined> {
    return (await this.sessionInfoPromise)?.accessToken;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("No access token");
    }

    const env = await getControlPlaneEnv(this.ideSettingsPromise);
    const url = new URL(path, env.CONTROL_PLANE_URL).toString();
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

<<<<<<< Updated upstream
  public async listAssistants(): Promise<
||||||| Stash base
  public async listAssistants(organizationId?: string): Promise<
=======
  public async listAssistants(organizationId: string | null): Promise<
>>>>>>> Stashed changes
    {
      configResult: ConfigResult<AssistantUnrolled>;
      ownerSlug: string;
      packageSlug: string;
      iconUrl: string;
    }[]
  > {
    const userId = await this.userId;
    if (!userId) {
      return [];
    }

    try {
      const resp = await this.request("ide/list-assistants", {
        method: "GET",
      });
      return (await resp.json()) as any;
    } catch (e) {
      return [];
    }
  }

<<<<<<< Updated upstream
  public async listAssistantFullSlugs(): Promise<FullSlug[] | null> {
||||||| Stash base
  public async listOrganizations(): Promise<Array<OrganizationDescription>> {
    return [
      {
        id: "1",
        iconUrl:
          "https://cdn.prod.website-files.com/663e06c56841363663ffbbcf/663e1b9fb023f0b622ad3608_log-text.svg",
        name: "Continue",
      },
    ];
    // const userId = await this.userId;
    // if (!userId) {
    //   return [];
    // }

    // try {
    //   const resp = await this.request("ide/list-organizations", {
    //     method: "GET",
    //   });
    //   const { organizations } = (await resp.json()) as any;
    //   return organizations;
    // } catch (e) {
    //   return [];
    // }
  }

  public async listAssistantFullSlugs(): Promise<FullSlug[] | null> {
=======
  public async listOrganizations(): Promise<Array<OrganizationDescription>> {
    const userId = await this.userId;

    if (!userId) {
      return [];
    }

    try {
      const resp = await this.request("ide/list-organizations", {
        method: "GET",
      });
      const { organizations } = (await resp.json()) as any;
      return organizations;
    } catch (e) {
      return [];
    }
  }

  public async listAssistantFullSlugs(
    organizationId: string | null,
  ): Promise<FullSlug[] | null> {
>>>>>>> Stashed changes
    const userId = await this.userId;
    if (!userId) {
      return null;
    }

    const url = organizationId
      ? `ide/list-assistant-full-slugs?organizationId=${organizationId}`
      : "ide/list-assistant-full-slugs";

    try {
      const resp = await this.request(url, {
        method: "GET",
      });
      const { fullSlugs } = (await resp.json()) as any;
      return fullSlugs;
    } catch (e) {
      return null;
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

  async syncSecrets(secretNames: string[]): Promise<Record<string, string>> {
    const userId = await this.userId;
    if (!userId) {
      throw new Error("No user id");
    }

    try {
      const resp = await this.request("ide/sync-secrets", {
        method: "POST",
        body: JSON.stringify({ secretNames }),
      });
      return (await resp.json()) as any;
    } catch (e) {
      return {};
    }
  }
}
