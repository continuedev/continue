import { agentFileProcessor, loadPackageFromHub } from "../hubLoader.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { AgentFileServiceState } from "./types.js";

/**
 * Service for managing agent file state
 * Loads agent files from the hub and extracts model, tools, and prompt information
 */
export class AgentFileService extends BaseService<AgentFileServiceState> {
  /**
   * Set the resolved agent file model name after it's been processed
   * Called by ConfigEnhancer after resolving the model slug
   */
  setagentFileModelName(modelName: string): void {
    this.setState({
      agentFileModelName: modelName,
    });
  }
  constructor() {
    super("AgentFileService", {
      agentFileService: null,
      agentFile: null,
      slug: null,
      agentFileModelName: null,
    });
  }

  /**
   * Initialize the agent file service with a hub slug
   */
  async doInitialize(agentFileSlug?: string): Promise<AgentFileServiceState> {
    if (!agentFileSlug) {
      return {
        agentFileService: this,
        agentFile: null,
        slug: null,
        agentFileModelName: null,
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

      return {
        agentFileService: this,
        agentFile,
        slug: agentFileSlug,
        agentFileModelName: null, // Will be set by ConfigEnhancer after model resolution
      };
    } catch (error: any) {
      logger.error("Failed to initialize AgentFileService:", error);
      return {
        agentFileService: this,
        agentFile: null,
        slug: null,
        agentFileModelName: null,
      };
    }
  }

  protected override setState(newState: Partial<AgentFileServiceState>): void {
    super.setState(newState);
    serviceContainer.set("update", this.currentState);
  }
}
