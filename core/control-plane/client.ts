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
  BaseSessionMetadata,
  IDE,
  ModelDescription,
  Session,
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

export interface CreditStatus {
  optedInToFreeTrial: boolean;
  hasCredits: boolean;
  creditBalance: number;
  hasPurchasedCredits: boolean;
}

export const TRIAL_PROXY_URL =
  "https://proxy-server-blue-l6vsfbzhba-uw.a.run.app";

export interface RemoteSessionMetadata extends BaseSessionMetadata {
  isRemote: true;
  remoteId: string;
}

export interface AgentSessionMetadata {
  createdBy: string;
  github_repo: string;
  organizationId?: string;
  idempotencyKey?: string;
  source?: string;
  continueApiKeyId?: string;
  s3Url?: string;
  prompt?: string | null;
  createdBySlug?: string;
}

export interface AgentSessionView {
  id: string;
  devboxId: string | null;
  name: string | null;
  icon: string | null;
  status: string;
  agentStatus: string | null;
  unread: boolean;
  state: string;
  metadata: AgentSessionMetadata;
  repoUrl: string;
  branch: string | null;
  pullRequestUrl: string | null;
  pullRequestStatus: string | null;
  tunnelUrl: string | null;
  createdAt: string;
  updatedAt: string;
  create_time_ms: string;
  end_time_ms: string;
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

  public async getCreditStatus(): Promise<CreditStatus | null> {
    if (!(await this.isSignedIn())) {
      return null;
    }

    try {
      const resp = await this.requestAndHandleError("ide/credits", {
        method: "GET",
      });
      return (await resp.json()) as CreditStatus;
    } catch (e) {
      // Capture control plane API failures to Sentry
      Logger.error(e, {
        context: "control_plane_credit_status",
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
   */
  public async shouldEnableRemoteSessions(): Promise<boolean> {
    // Check if user is signed in
    if (!(await this.isSignedIn())) {
      return false;
    }

    try {
      const sessionInfo = await this.sessionInfoPromise;
      if (isOnPremSession(sessionInfo) || !sessionInfo) {
        return false;
      }

      return true;
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
   */
  public async listRemoteSessions(): Promise<RemoteSessionMetadata[]> {
    if (!(await this.isSignedIn())) {
      return [];
    }

    try {
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

  /**
   * Create a new background agent
   */
  public async createBackgroundAgent(
    prompt: string,
    repoUrl: string,
    name: string,
    branch?: string,
    organizationId?: string,
    contextItems?: any[],
    selectedCode?: any[],
    agent?: string,
  ): Promise<{ id: string }> {
    if (!(await this.isSignedIn())) {
      throw new Error("Not signed in to Continue");
    }

    const requestBody: any = {
      prompt,
      repoUrl,
      name,
      branchName: branch,
    };

    if (organizationId) {
      requestBody.organizationId = organizationId;
    }

    // Include context items if provided
    if (contextItems && contextItems.length > 0) {
      requestBody.contextItems = contextItems.map((item) => ({
        content: item.content,
        description: item.description,
        name: item.name,
        uri: item.uri,
      }));
    }

    // Include selected code if provided
    if (selectedCode && selectedCode.length > 0) {
      requestBody.selectedCode = selectedCode.map((code) => ({
        filepath: code.filepath,
        range: code.range,
        contents: code.contents,
      }));
    }

    // Include agent configuration if provided
    if (agent) {
      requestBody.agent = agent;
    }

    const resp = await this.requestAndHandleError("agents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    return (await resp.json()) as { id: string };
  }

  /**
   * List all background agents for the current user or organization
   * @param organizationId - Optional organization ID to filter agents by organization scope
   * @param limit - Optional limit for number of agents to return (default: 5)
   */
  public async listBackgroundAgents(
    organizationId?: string,
    limit?: number,
  ): Promise<{
    agents: Array<{
      id: string;
      name: string | null;
      status: string;
      repoUrl: string;
      createdAt: string;
      metadata?: {
        github_repo?: string;
      };
    }>;
    totalCount: number;
  }> {
    if (!(await this.isSignedIn())) {
      return { agents: [], totalCount: 0 };
    }

    try {
      // Build URL with query parameters
      const params = new URLSearchParams();
      if (organizationId) {
        params.set("organizationId", organizationId);
      }
      if (limit !== undefined) {
        params.set("limit", limit.toString());
      }

      const url = `agents${params.toString() ? `?${params.toString()}` : ""}`;

      const resp = await this.requestAndHandleError(url, {
        method: "GET",
      });

      const result = (await resp.json()) as {
        agents: AgentSessionView[];
        totalCount: number;
      };

      return {
        agents: result.agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          status: agent.status,
          repoUrl: agent.repoUrl,
          createdAt: agent.createdAt,
          metadata: {
            github_repo: agent.metadata.github_repo,
          },
        })),
        totalCount: result.totalCount,
      };
    } catch (e) {
      Logger.error(e, {
        context: "control_plane_list_background_agents",
      });
      return { agents: [], totalCount: 0 };
    }
  }

  /**
   * Get the full agent session information
   * @param agentSessionId - The ID of the agent session
   * @returns The agent session view including metadata and status
   */
  public async getAgentSession(
    agentSessionId: string,
  ): Promise<AgentSessionView | null> {
    if (!(await this.isSignedIn())) {
      return null;
    }

    try {
      const resp = await this.requestAndHandleError(
        `agents/${agentSessionId}`,
        {
          method: "GET",
        },
      );

      return (await resp.json()) as AgentSessionView;
    } catch (e) {
      Logger.error(e, {
        context: "control_plane_get_agent_session",
        agentSessionId,
      });
      return null;
    }
  }

  /**
   * Get the state of a specific background agent
   * @param agentSessionId - The ID of the agent session
   * @returns The agent's session state including history, workspace, and branch
   */
  public async getAgentState(agentSessionId: string): Promise<{
    session: Session;
    isProcessing: boolean;
    messageQueueLength: number;
    pendingPermission: any;
  } | null> {
    if (!(await this.isSignedIn())) {
      return null;
    }

    try {
      const resp = await this.requestAndHandleError(
        `agents/${agentSessionId}/state`,
        {
          method: "GET",
        },
      );

      const result = (await resp.json()) as {
        session: Session;
        isProcessing: boolean;
        messageQueueLength: number;
        pendingPermission: any;
      };
      return result;
    } catch (e) {
      Logger.error(e, {
        context: "control_plane_get_agent_state",
        agentSessionId,
      });
      return null;
    }
  }
}
