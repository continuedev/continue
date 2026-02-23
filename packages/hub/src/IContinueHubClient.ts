import {
  AssistantUnrolled,
  ConfigResult,
  FQSN,
  FullSlug,
  SecretResult,
} from "@continuedev/config-yaml";

/**
 * Interface for the Continue Hub client.
 */
export interface IContinueHubClient {
  resolveFQSNs(
    fqsns: FQSN[],
    orgScopeId: string | null,
  ): Promise<(SecretResult | undefined)[]>;

  /**
   * Do a full reload of all assistants used in the organization by the user.
   */
  listAssistants(options: {
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
  >;

  /**
   * Get the list of FullSlugs (ownerSlug/packageSlug@versionSlug) for all assistant uses in the organization for the user.
   * Can be used to poll for changes to assistants and then full reload when needed.
   */
  listAssistantFullSlugs(
    organizationId: string | null,
  ): Promise<FullSlug[] | null>;
}
