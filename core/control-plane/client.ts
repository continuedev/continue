import { ConfigJson } from "@continuedev/config-types";
import {
  AssistantUnrolled,
  ConfigResult,
  FQSN,
  FullSlug,
  Policy,
  SecretResult,
  SecretType,
} from "@continuedev/config-yaml";
import fetch, { RequestInit, Response } from "node-fetch";

import { OrganizationDescription } from "../config/ProfileLifecycleManager.js";
import {
  IDE,
  ModelDescription,
  Session,
  BaseSessionMetadata,
} from "../index.js";
import { Logger } from "../util/Logger.js";

import {
  ControlPlaneSessionInfo,
  HubSessionInfo,
  isOnPremSession,
} from "./AuthTypes.js";
import { getControlPlaneEnv } from "./env.js";

export interface PolicyResponse {
  orgSlug?: string;
  policy?: Policy;
}

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

export interface RemoteSessionMetadata extends BaseSessionMetadata {
  isRemote: true;
  remoteId: string;
}

export class ControlPlaneClient {
  constructor(
    readonly sessionInfoPromise: Promise<ControlPlaneSessionInfo | undefined>,
    private readonly ide: IDE,
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

    const resp = await this.requestAndHandleError("ide/sync-secrets", {
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

    const env = await getControlPlaneEnv(this.ide.getIdeSettings());
    const url = new URL(path, env.CONTROL_PLANE_URL).toString();
    const ideInfo = await this.ide.getIdeInfo();

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

    return resp;
  }

  private async requestAndHandleError(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    const resp = await this.request(path, init);

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

      const resp = await this.requestAndHandleError(url, {
        method: "GET",
      });
      return (await resp.json()) as any;
    } catch (e) {
      // Capture control plane API failures to Sentry
      Logger.error(e, {
        context: "control_plane_list_assistants",
        organizationId,
      });
      return [];
    }
  }

  public async listOrganizations(): Promise<Array<OrganizationDescription>> {
    if (!(await this.isSignedIn())) {
      return [];
    }

    // We try again here because when users sign up with an email domain that is
    // captured by an org, we need to wait for the user account creation webhook to
    // take effect. Otherwise the organization(s) won't show up.
    // This error manifests as a 404 (user not found)
    let retries = 0;
    const maxRetries = 10;
    const maxWaitTime = 20000; // 20 seconds in milliseconds

    while (retries < maxRetries) {
      const resp = await this.request("ide/list-organizations", {
        method: "GET",
      });

      if (resp.status === 404) {
        retries++;
        if (retries >= maxRetries) {
          console.warn(
            `Failed to list organizations after ${maxRetries} retries: user not found`,
          );
          return [];
        }
        const waitTime = Math.min(
          Math.pow(2, retries) * 100,
          maxWaitTime / maxRetries,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      } else if (!resp.ok) {
        console.warn(
          `Failed to list organizations (${resp.status}): ${await resp.text()}`,
        );
        return [];
      }
      const { organizations } = (await resp.json()) as any;
      return organizations;
    }

    // This should never be reached due to the while condition, but adding for safety
    console.warn(
      `Failed to list organizations after ${maxRetries} retries: maximum attempts exceeded`,
    );
    return [];
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
      const resp = await this.requestAndHandleError(url, {
        method: "GET",
      });
      const { fullSlugs } = (await resp.json()) as any;
      return fullSlugs;
    } catch (e) {
      // Capture control plane API failures to Sentry
      Logger.error(e, {
        context: "control_plane_list_assistant_slugs",
        organizationId,
      });
      return null;
    }
  }

  public async getPolicy(): Promise<PolicyResponse | null> {
    if (!(await this.isSignedIn())) {
      return null;
    }

    try {
      const resp = await this.request(`ide/policy`, {
        method: "GET",
      });
      return (await resp.json()) as PolicyResponse;
    } catch (e) {
      return null;
    }
  }

  public async getFreeTrialStatus(): Promise<FreeTrialStatus | null> {
    if (!(await this.isSignedIn())) {
      return null;
    }

    try {
      const resp = await this.requestAndHandleError("ide/free-trial-status", {
        method: "GET",
      });
      return (await resp.json()) as FreeTrialStatus;
    } catch (e) {
      // Capture control plane API failures to Sentry
      Logger.error(e, {
        context: "control_plane_free_trial_status",
      });
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

      const resp = await this.requestAndHandleError(
        `ide/get-models-add-on-checkout-url?${params.toString()}`,
        {
          method: "GET",
        },
      );
      return (await resp.json()) as { url: string };
    } catch (e) {
      // Capture control plane API failures to Sentry
      Logger.error(e, {
        context: "control_plane_models_checkout_url",
        vsCodeUriScheme,
      });
      return null;
    }
  }

  /**
   * Check if remote sessions should be enabled based on feature flags
   * Requires: PostHog feature flag AND @continue.dev email
   */
  public async shouldEnableRemoteSessions(): Promise<boolean> {
    // Check if user is signed in
    if (!(await this.isSignedIn())) {
      return false;
    }

    // Check if user has @continue.dev email
    try {
      const sessionInfo = await this.sessionInfoPromise;
      if (isOnPremSession(sessionInfo) || !sessionInfo) {
        return false;
      }

      const hubSession = sessionInfo as HubSessionInfo;
      const email = hubSession.account?.id;

      return email ? email.includes("@continue.dev") : false;
    } catch (e) {
      Logger.error(e, {
        context: "control_plane_check_remote_sessions_enabled",
      });
      return false;
    }
  }

  /**
   * Get current user's session info
   */
  public async getSessionInfo(): Promise<ControlPlaneSessionInfo | undefined> {
    return await this.sessionInfoPromise;
  }

  /**
   * Fetch remote agents/sessions from the control plane
   * Currently restricted to @continue.dev emails for internal use
   */
  public async listRemoteSessions(): Promise<RemoteSessionMetadata[]> {
    if (!(await this.isSignedIn())) {
      return [];
    }

    try {
      // Note: This endpoint is currently restricted to internal @continue.dev users
      // In the future, this may be expanded to support broader remote session access
      const resp = await this.requestAndHandleError("agents/devboxes", {
        method: "GET",
      });

      const agents = (await resp.json()) as any[];

      return agents.map(
        (agent: any): RemoteSessionMetadata => ({
          sessionId: `remote-${agent.id}`,
          title: agent.name || "Remote Agent",
          dateCreated: new Date(agent.create_time_ms).toISOString(),
          workspaceDirectory: "",
          isRemote: true,
          remoteId: agent.id,
        }),
      );
    } catch (e) {
      // Log error but don't throw - remote sessions are optional
      Logger.error(e, {
        context: "control_plane_list_remote_sessions",
      });
      return [];
    }
  }

  public async loadRemoteSession(remoteId: string): Promise<Session> {
    if (!(await this.isSignedIn())) {
      throw new Error("Not signed in to load remote session");
    }

    try {
      // First get the tunnel URL for the remote agent
      const tunnelResp = await this.requestAndHandleError(
        `agents/devboxes/${remoteId}/tunnel`,
        {
          method: "POST",
        },
      );

      const tunnelData = (await tunnelResp.json()) as { url?: string };
      const tunnelUrl = tunnelData.url;

      if (!tunnelUrl) {
        throw new Error(`Failed to get tunnel URL for agent ${remoteId}`);
      }

      // Now fetch the session state from the remote agent's /state endpoint
      const stateResponse = await fetch(`${tunnelUrl}/state`);
      if (!stateResponse.ok) {
        throw new Error(
          `Failed to fetch state from remote agent: ${stateResponse.statusText}`,
        );
      }

      const remoteState = (await stateResponse.json()) as { session?: Session };

      // The remote state contains a session property with the full session data
      if (!remoteState.session) {
        throw new Error(
          "Remote agent returned invalid state - no session found",
        );
      }

      return remoteState.session;
    } catch (e) {
      Logger.error(e, {
        context: "control_plane_load_remote_session",
        remoteId,
      });
      throw new Error(
        `Failed to load remote session: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    }
  }
}
