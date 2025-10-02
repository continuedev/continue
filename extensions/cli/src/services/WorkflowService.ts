import { parseWorkflowFile, WorkflowFile } from "@continuedev/config-yaml";

import { HubPackageProcessor, loadPackageFromHub } from "../hubLoader.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { WorkflowServiceState } from "./types.js";

/**
 * Workflow processor - handles markdown workflow files
 */
export const workflowProcessor: HubPackageProcessor<WorkflowFile> = {
  type: "prompt",
  expectedFileExtensions: [".md"],
  parseContent: (content: string) => parseWorkflowFile(content),
  validateContent: (workflowFile: WorkflowFile) => {
    return !!workflowFile.name;
  },
};

/**
 * Service for managing workflow state
 * Loads workflows from the hub and extracts model, tools, and prompt information
 */
export class WorkflowService extends BaseService<WorkflowServiceState> {
  constructor() {
    super("WorkflowService", {
      workflowFile: null,
      workflow: null,
      isActive: false,
    });
  }

  /**
   * Initialize the workflow service with a workflow slug
   */
  async doInitialize(workflow?: string): Promise<WorkflowServiceState> {
    logger.debug("WorkflowService.doInitialize called", {
      hasWorkflow: !!workflow,
      workflow,
    });

    if (!workflow) {
      return {
        workflowFile: null,
        workflow: null,
        isActive: false,
      };
    }

    try {
      const parts = workflow.split("/");
      if (parts.length !== 2) {
        throw new Error(
          `Invalid workflow slug format. Expected "owner/package", got: ${workflow}`,
        );
      }

      const workflowFile = await loadPackageFromHub(
        workflow,
        workflowProcessor,
      );

      return {
        workflowFile,
        workflow,
        isActive: true,
      };
    } catch (error: any) {
      logger.error("Failed to initialize WorkflowService:", error);
      return {
        workflowFile: null,
        workflow: null,
        isActive: false,
      };
    }
  }
}
