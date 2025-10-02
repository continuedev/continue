import { parseWorkflowFile, WorkflowFile } from "@continuedev/config-yaml";

import { HubPackageProcessor, loadPackageFromHub } from "../hubLoader.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import { WorkflowServiceState } from "./types.js";

/**
 * Workflow processor - handles markdown workflow files
 */
export const workflowProcessor: HubPackageProcessor<WorkflowFile> = {
  type: "prompt", // Use prompt type for endpoint compatibility
  expectedFileExtensions: [".md"],
  parseContent: (content: string) => parseWorkflowFile(content),
  validateContent: (workflowFile: WorkflowFile) => {
    // Validate that the workflow has a name (required by parseWorkflowFile)
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
      // Validate slug format (ownerSlug/packageSlug)
      const parts = workflow.split("/");
      if (parts.length !== 2) {
        throw new Error(
          `Invalid workflow slug format. Expected "owner/package", got: ${workflow}`,
        );
      }

      logger.debug("Loading workflow from hub", { workflow });
      const workflowFile = await loadPackageFromHub(
        workflow,
        workflowProcessor,
      );

      logger.debug("Workflow loaded successfully", {
        workflow,
        name: workflowFile.name,
        hasModel: !!workflowFile.model,
        hasTools: !!workflowFile.tools,
        hasRules: !!workflowFile.rules,
        promptLength: workflowFile.prompt?.length || 0,
      });

      return {
        workflowFile,
        workflow,
        isActive: true,
      };
    } catch (error: any) {
      logger.error("Failed to initialize WorkflowService:", error);
      // Don't throw - allow the system to continue without the workflow
      return {
        workflowFile: null,
        workflow: null,
        isActive: false,
      };
    }
  }

  /**
   * Get the loaded workflow file
   */
  getWorkflowFile(): WorkflowFile | null {
    return this.getState().workflowFile;
  }

  /**
   * Get the workflow slug
   */
  getWorkflow(): string | null {
    return this.getState().workflow;
  }

  /**
   * Check if a workflow is active
   */
  isWorkflowActive(): boolean {
    return this.getState().isActive;
  }

  /**
   * Get workflow model if present
   */
  getWorkflowModel(): string | undefined {
    const workflowFile = this.getWorkflowFile();
    return workflowFile?.model;
  }

  /**
   * Get workflow tools if present
   */
  getWorkflowTools(): string | undefined {
    const workflowFile = this.getWorkflowFile();
    return workflowFile?.tools;
  }

  /**
   * Get workflow rules if present
   */
  getWorkflowRules(): string | undefined {
    const workflowFile = this.getWorkflowFile();
    return workflowFile?.rules;
  }

  /**
   * Get workflow prompt
   */
  getWorkflowPrompt(): string | undefined {
    const workflowFile = this.getWorkflowFile();
    return workflowFile?.prompt;
  }
}
