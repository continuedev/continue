import { loadPackageFromHub, workflowProcessor } from "../hubLoader.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { WorkflowServiceState } from "./types.js";

/**
 * Service for managing workflow state
 * Loads workflows from the hub and extracts model, tools, and prompt information
 */
export class WorkflowService extends BaseService<WorkflowServiceState> {
  constructor() {
    super("WorkflowService", {
      workflowFile: null,
      slug: null,
    });
  }

  /**
   * Initialize the workflow service with a workflow slug
   */
  async doInitialize(workflowSlug?: string): Promise<WorkflowServiceState> {
    if (!workflowSlug) {
      return {
        workflowFile: null,
        slug: null,
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
        workflowFile,
        slug: workflowSlug,
      };
    } catch (error: any) {
      logger.error("Failed to initialize WorkflowService:", error);
      return {
        workflowFile: null,
        slug: null,
      };
    }
  }
}
