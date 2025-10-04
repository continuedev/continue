import { loadPackageFromHub, workflowProcessor } from "../hubLoader.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { WorkflowServiceState } from "./types.js";

/**
 * Service for managing workflow state
 * Loads workflows from the hub and extracts model, tools, and prompt information
 */
export class WorkflowService extends BaseService<WorkflowServiceState> {
  /**
   * Set the resolved workflow model name after it's been processed
   * Called by ConfigEnhancer after resolving the model slug
   */
  setWorkflowModelName(modelName: string): void {
    this.setState({
      workflowModelName: modelName,
    });
  }
  constructor() {
    super("WorkflowService", {
      workflowService: null,
      workflowFile: null,
      slug: null,
      workflowModelName: null,
    });
  }

  /**
   * Initialize the workflow service with a workflow slug
   */
  async doInitialize(workflowSlug?: string): Promise<WorkflowServiceState> {
    if (!workflowSlug) {
      return {
        workflowService: this,
        workflowFile: null,
        slug: null,
        workflowModelName: null,
      };
    }

    try {
      const parts = workflowSlug.split("/");
      if (parts.length !== 2) {
        throw new Error(
          `Invalid workflow slug format. Expected "owner/package", got: ${workflowSlug}`,
        );
      }

      const workflowFile = await loadPackageFromHub(
        workflowSlug,
        workflowProcessor,
      );

      return {
        workflowService: this,
        workflowFile,
        slug: workflowSlug,
        workflowModelName: null, // Will be set by ConfigEnhancer after model resolution
      };
    } catch (error: any) {
      logger.error("Failed to initialize WorkflowService:", error);
      return {
        workflowService: this,
        workflowFile: null,
        slug: null,
        workflowModelName: null,
      };
    }
  }

  protected override setState(newState: Partial<WorkflowServiceState>): void {
    super.setState(newState);
    serviceContainer.set("update", this.currentState);
  }
}
