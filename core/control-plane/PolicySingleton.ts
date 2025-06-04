import { Policy } from "@continuedev/config-yaml";
import { ControlPlaneClient } from "./client.js";

/**
 * A singleton class that caches policy information fetched from the control plane.
 * The policy is only reloaded when explicitly requested.
 */
export class PolicySingleton {
  private static instance: PolicySingleton;
  private policy: Policy | null = null;
  private orgSlug: string | null = null;

  private constructor(private client: ControlPlaneClient) {}

  /**
   * Get the singleton instance of PolicySingleton
   */
  public static getInstance(client: ControlPlaneClient): PolicySingleton {
    if (!PolicySingleton.instance) {
      PolicySingleton.instance = new PolicySingleton(client);
    }
    return PolicySingleton.instance;
  }

  /**
   * Get the cached policy for an organization or fetch it if not yet cached
   * @param orgSlug The organization slug
   * @param forceReload Whether to force a reload of the policy from the server
   * @returns The policy or null if it couldn't be fetched
   */
  public async getPolicy(
    orgSlug: string,
    forceReload = false,
  ): Promise<Policy | null> {
    // If we're requesting a different org or forcing reload, update the policy
    if (forceReload || this.orgSlug !== orgSlug || this.policy === null) {
      this.orgSlug = orgSlug;
      this.policy = await this.client.getPolicy(orgSlug);
    }

    return this.policy;
  }

  /**
   * Clear the cached policy
   */
  public clearCache(): void {
    this.policy = null;
    this.orgSlug = null;
  }
}
