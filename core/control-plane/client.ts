import { ConfigJson } from "@continuedev/config-types";
import {
  AssistantUnrolled,
  ConfigResult,
  FQSN,
  FullSlug,
  SecretResult,
  SecretType,
} from "@continuedev/config-yaml";
import fetch, { RequestInit, Response } from "node-fetch";

import { OrganizationDescription } from "../config/ProfileLifecycleManager.js";
import { IdeInfo, IdeSettings, ModelDescription } from "../index.js";

import { ControlPlaneSessionInfo, isOnPremSession } from "./AuthTypes.js";
import { getControlPlaneEnv } from "./env.js";

export interface ControlPlaneWorkspace {
  id: string;
  name: string;
  settings: ConfigJson;
}

export interface ControlPlaneModelDescription extends ModelDescription {}

export interface FreeTrialStatus {
  optedInToFreeTrial: boolean;
  chatCount?: number;
  autocompleteCount?: number;
  chatLimit: number;
  autocompleteLimit: number;
}

export const TRIAL_PROXY_URL =
  "https://proxy-server-blue-l6vsfbzhba-uw.a.run.app";

export class ControlPlaneClient {
  constructor(
    private readonly sessionInfoPromise: Promise<
      ControlPlaneSessionInfo | undefined
    >,
    private readonly ideSettingsPromise: Promise<IdeSettings>,
    private readonly ideInfoPromise: Promise<IdeInfo>,
  ) {}

  async resolveFQSNs(
    fqsns: FQSN[],
    orgScopeId: string | null,
  ): Promise<(SecretResult | undefined)[]> {
    if (!(await this.isSignedIn())) {
      return fqsns.map((fqsn) => ({
        found: false,
        fqsn,
        secretLocation: {
          secretName: fqsn.secretName,
          secretType: SecretType.NotFound,
        },
      }));
    }

    const resp = await this.request("ide/sync-secrets", {
      method: "POST",
      body: JSON.stringify({ fqsns, orgScopeId }),
    });
    return (await resp.json()) as any;
  }

  async isSignedIn(): Promise<boolean> {
    const sessionInfo = await this.sessionInfoPromise;
    return !!sessionInfo;
  }

  async getAccessToken(): Promise<string | undefined> {
    const sessionInfo = await this.sessionInfoPromise;
    return isOnPremSession(sessionInfo) ? undefined : sessionInfo?.accessToken;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const sessionInfo = await this.sessionInfoPromise;
    const onPremSession = isOnPremSession(sessionInfo);
    const accessToken = await this.getAccessToken();

    // Bearer token not necessary for on-prem auth type
    if (!accessToken && !onPremSession) {
      throw new Error("No access token");
    }

    const env = await getControlPlaneEnv(this.ideSettingsPromise);
    const url = new URL(path, env.CONTROL_PLANE_URL).toString();
    const ideInfo = await this.ideInfoPromise;

    const resp = await fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
        ...{
          "x-extension-version": ideInfo.extensionVersion,
          "x-is-prerelease": String(ideInfo.isPrerelease),
        },
      },
    });

    if (!resp.ok) {
      throw new Error(
        `Control plane request failed: ${resp.status} ${await resp.text()}`,
      );
    }

    return resp;
  }

  public async listAssistants(organizationId: string | null): Promise<
    {
      configResult: ConfigResult<AssistantUnrolled>;
      ownerSlug: string;
      packageSlug: string;
      iconUrl: string;
      rawYaml: string;
    }[]
  > {
    if (!(await this.isSignedIn())) {
      return [];
    }

    try {
      const url = organizationId
        ? `ide/list-assistants?organizationId=${organizationId}`
        : "ide/list-assistants";

      const resp = await this.request(url, {
        method: "GET",
      });
      return (await resp.json()) as any;
    } catch (e) {
      return [];
    }
  }

  public async listOrganizations(): Promise<Array<OrganizationDescription>> {
    if (!(await this.isSignedIn())) {
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
    if (!(await this.isSignedIn())) {
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

  public async getFreeTrialStatus(): Promise<FreeTrialStatus | null> {
    if (!(await this.isSignedIn())) {
      return null;
    }

    try {
      const resp = await this.request("ide/free-trial-status", {
        method: "GET",
      });
      return (await resp.json()) as FreeTrialStatus;
    } catch (e) {
      return null;
    }
  }

  /**
   * JetBrains does not support deep links, so we only check for `vsCodeUriScheme`
   * @param vsCodeUriScheme
   * @returns
   */
  public async getModelsAddOnCheckoutUrl(
    vsCodeUriScheme?: string,
  ): Promise<{ url: string } | null> {
    if (!(await this.isSignedIn())) {
      return null;
    }

    try {
      const params = new URLSearchParams({
        // LocalProfileLoader ID
        profile_id: "local",
      });

      if (vsCodeUriScheme) {
        params.set("vscode_uri_scheme", vsCodeUriScheme);
      }

      const resp = await this.request(
        `ide/get-models-add-on-checkout-url?${params.toString()}`,
        {
          method: "GET",
        },
      );
      return (await resp.json()) as { url: string };
    } catch (e) {
      return null;
    }
  }
}
