import {
  parseAgentFileRules,
  parseAgentFileTools,
} from "@continuedev/config-yaml";

import {
  agentFileProcessor,
  loadModelFromHub,
  loadPackageFromHub,
} from "../hubLoader.js";
import { logger } from "../util/logger.js";

import { BaseService, ServiceWithDependencies } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import {
  AgentFileServiceState,
  ApiClientServiceState,
  AuthServiceState,
  SERVICE_NAMES,
} from "./types.js";

export const EMPTY_AGENT_FILE_STATE: AgentFileServiceState = {
  agentFile: null,
  slug: null,
  parsedRules: null,
  parsedTools: null,
  agentFileModel: null,
};
/**
 * Service for managing agent file state
 * Loads agent files from the hub and extracts model, tools, and prompt information
 */
export class AgentFileService
  extends BaseService<AgentFileServiceState>
  implements ServiceWithDependencies
{
  constructor() {
    super("AgentFileService", {
      ...EMPTY_AGENT_FILE_STATE,
    });
  }

  getDependencies(): string[] {
    return [SERVICE_NAMES.AUTH, SERVICE_NAMES.API_CLIENT];
  }

  /**
   * Initialize the agent file service with a hub slug
   */
  async doInitialize(
    agentFileSlug: string | undefined,
    authServiceState: AuthServiceState,
    apiClientState: ApiClientServiceState,
  ): Promise<AgentFileServiceState> {
    if (!agentFileSlug) {
      return {
        ...EMPTY_AGENT_FILE_STATE,
      };
    }

    try {
      const parts = agentFileSlug.split("/");
      if (parts.length !== 2) {
        throw new Error(
          `Invalid agent slug format. Expected "owner/package", got: ${agentFileSlug}`,
        );
      }

      const agentFile = await loadPackageFromHub(
        agentFileSlug,
        agentFileProcessor,
      );

      // Set the basic agent file state
      this.setState({
        agentFile,
        slug: agentFileSlug,
      });

      if (agentFile.model) {
        if (!apiClientState.apiClient) {
          throw new Error(
            "Cannot load agent model, failed to load api client service",
          );
        }
        const model = await loadModelFromHub(agentFile.model);
        this.setState({
          agentFileModel: model,
        });
      }

      if (agentFile.rules) {
        this.setState({
          parsedRules: parseAgentFileRules(agentFile.rules),
        });
      }

      if (agentFile.tools) {
        this.setState({
          parsedTools: parseAgentFileTools(agentFile.tools),
        });
      }

      return this.getState();
    } catch (error: any) {
      logger.error("Failed to initialize AgentFileService:", error);
      throw error;
    }
  }

  protected override setState(newState: Partial<AgentFileServiceState>): void {
    super.setState(newState);
    serviceContainer.set("update", this.currentState);
  }
}
