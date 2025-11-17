import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  AgentFile,
  parseAgentFile,
  parseAgentFileRules,
  parseAgentFileTools,
} from "@continuedev/config-yaml";

import { getErrorString } from "src/util/error.js";

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

  async getAgentFile(agentPath: string): Promise<AgentFile> {
    try {
      const parts = agentPath.split("/");
      if (parts.length === 2 && parts[0] && parts[1] && !parts.includes(".")) {
        try {
          return await loadPackageFromHub(agentPath, agentFileProcessor);
        } catch (e) {
          logger.info(
            `Failed to load agent file from slug-like path ${agentPath}: ${getErrorString(e)}`,
          );
          // slug COULD be path, fall back to relative path
        }
      }
      const resolvedPath = agentPath.startsWith("file:/")
        ? fileURLToPath(agentPath)
        : path.resolve(agentPath);
      const content = fs.readFileSync(resolvedPath, "utf-8");
      return parseAgentFile(content);
    } catch (e) {
      throw new Error(
        `Failed to load agent from ${agentPath}: ${getErrorString(e)}`,
      );
    }
  }

  /**
   * Initialize the agent file service with a hub slug
   */
  async doInitialize(
    agentFilePath: string | undefined,
    authServiceState: AuthServiceState,
    apiClientState: ApiClientServiceState,
  ): Promise<AgentFileServiceState> {
    if (!agentFilePath) {
      return {
        ...EMPTY_AGENT_FILE_STATE,
      };
    }

    try {
      const agentFile = await this.getAgentFile(agentFilePath);

      // Set the basic agent file state
      this.setState({
        agentFile,
        slug: agentFilePath,
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
