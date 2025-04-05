import {
  AssistantUnrolled,
  ConfigResult,
  FQSN,
  FullSlug,
  SecretResult,
} from "@continuedev/config-yaml";
import { IContinueHubClient } from "./IContinueHubClient.js";

interface ContinueHubClientOptions {
  apiKey?: string;
  apiBase?: string;
  fetchOptions?: RequestInit;
}

export class ContinueHubClient implements IContinueHubClient {
  private readonly apiKey?: string;
  private readonly apiBase: string;
  private readonly fetchOptions?: RequestInit;

  constructor(options: ContinueHubClientOptions) {
    this.apiKey = options.apiKey;
    this.apiBase = options.apiBase ?? "https://api.continue.dev";
    this.fetchOptions = options.fetchOptions;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const url = new URL(path, this.apiBase).toString();

    const finalInit: RequestInit = {
      ...this.fetchOptions,
      ...init,
      headers: {
        ...this.fetchOptions?.headers,
        ...init.headers,
      },
    };

    if (this.apiKey) {
      finalInit.headers = {
        ...finalInit.headers,
        Authorization: `Bearer ${this.apiKey}`,
      };
    }

    const resp = await fetch(url, finalInit);

    if (!resp.ok) {
      throw new Error(
        `Control plane request failed: ${resp.status} ${await resp.text()}`,
      );
    }

    return resp;
  }

  async resolveFQSNs(
    fqsns: FQSN[],
    orgScopeId: string | null,
  ): Promise<(SecretResult | undefined)[]> {
    const resp = await this.request("ide/sync-secrets", {
      method: "POST",
      body: JSON.stringify({ fqsns, orgScopeId }),
    });
    return (await resp.json()) as any;
  }
  async listAssistants(options: {
    organizationId: string | null;
    alwaysUseProxy?: boolean;
  }): Promise<
    {
      configResult: ConfigResult<AssistantUnrolled>;
      ownerSlug: string;
      packageSlug: string;
      iconUrl: string;
      rawYaml: string;
    }[]
  > {
    const organizationId = options.organizationId;
    const alwaysUseProxy = options.alwaysUseProxy ?? false;

    try {
      const urlObj = new URL(
        organizationId ? "ide/list-assistants" : "ide/list-assistants",
        this.apiBase,
      );
      if (organizationId) {
        urlObj.searchParams.set("organizationId", organizationId);
      }
      if (alwaysUseProxy) {
        urlObj.searchParams.set("alwaysUseProxy", alwaysUseProxy.toString());
      }
      const url = urlObj.toString();

      const resp = await this.request(url, {
        method: "GET",
      });
      return (await resp.json()) as any;
    } catch (e) {
      return [];
    }
  }

  async listAssistantFullSlugs(
    organizationId: string | null,
  ): Promise<FullSlug[] | null> {
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
}
