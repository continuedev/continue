import { vi } from "vitest";

import { WorkflowService, workflowProcessor } from "./WorkflowService.js";

// Mock the hubLoader module
vi.mock("../hubLoader.js", () => ({
  loadPackageFromHub: vi.fn(),
  HubPackageProcessor: vi.fn(),
}));

// Mock the logger
vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("WorkflowService", () => {
  let service: WorkflowService;
  let mockLoadPackageFromHub: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new WorkflowService();

    // Get the mock function
    const hubLoaderModule = await import("../hubLoader.js");
    mockLoadPackageFromHub = hubLoaderModule.loadPackageFromHub as any;
  });

  describe("initialization", () => {
    it("should initialize with inactive state when no workflow provided", async () => {
      const state = await service.initialize();

      expect(state).toEqual({
        workflowFile: null,
        workflow: null,
        isActive: false,
      });
    });

    it("should initialize with inactive state when workflow is empty string", async () => {
      const state = await service.initialize("");

      expect(state).toEqual({
        workflowFile: null,
        workflow: null,
        isActive: false,
      });
    });

    it("should reject invalid workflow slug format", async () => {
      const state = await service.initialize("invalid-slug");

      expect(state).toEqual({
        workflowFile: null,
        workflow: null,
        isActive: false,
      });

      // Should not call loadPackageFromHub with invalid slug
      expect(mockLoadPackageFromHub).not.toHaveBeenCalled();
    });

    it("should reject workflow slug with too many parts", async () => {
      const state = await service.initialize("owner/package/extra");

      expect(state).toEqual({
        workflowFile: null,
        workflow: null,
        isActive: false,
      });

      expect(mockLoadPackageFromHub).not.toHaveBeenCalled();
    });

    it("should load valid workflow successfully", async () => {
      const mockWorkflowFile = {
        name: "Test Workflow",
        description: "A test workflow",
        model: "gpt-4",
        tools: "bash,read,write",
        rules: "Be helpful",
        prompt: "You are a helpful assistant.",
      };

      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);

      const state = await service.initialize("owner/package");

      expect(state).toEqual({
        workflowFile: mockWorkflowFile,
        workflow: "owner/package",
        isActive: true,
      });

      expect(mockLoadPackageFromHub).toHaveBeenCalledWith(
        "owner/package",
        workflowProcessor,
      );
    });

    it("should handle loading errors gracefully", async () => {
      mockLoadPackageFromHub.mockRejectedValue(new Error("Network error"));

      const state = await service.initialize("owner/package");

      expect(state).toEqual({
        workflowFile: null,
        workflow: null,
        isActive: false,
      });

      expect(mockLoadPackageFromHub).toHaveBeenCalledWith(
        "owner/package",
        workflowProcessor,
      );
    });

    it("should handle minimal workflow file", async () => {
      const mockWorkflowFile = {
        name: "Minimal Workflow",
        prompt: "",
      };

      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);

      const state = await service.initialize("owner/minimal");

      expect(state).toEqual({
        workflowFile: mockWorkflowFile,
        workflow: "owner/minimal",
        isActive: true,
      });
    });
  });

  describe("state getters", () => {
    beforeEach(async () => {
      const mockWorkflowFile = {
        name: "Test Workflow",
        description: "A test workflow",
        model: "gpt-4",
        tools: "bash,read,write",
        rules: "Be helpful",
        prompt: "You are a helpful assistant.",
      };

      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await service.initialize("owner/package");
    });

    it("should return workflow file", () => {
      const workflowFile = service.getWorkflowFile();
      expect(workflowFile?.name).toBe("Test Workflow");
    });

    it("should return workflow slug", () => {
      const workflow = service.getWorkflow();
      expect(workflow).toBe("owner/package");
    });

    it("should return active status", () => {
      const isActive = service.isWorkflowActive();
      expect(isActive).toBe(true);
    });

    it("should return workflow model", () => {
      const model = service.getWorkflowModel();
      expect(model).toBe("gpt-4");
    });

    it("should return workflow tools", () => {
      const tools = service.getWorkflowTools();
      expect(tools).toBe("bash,read,write");
    });

    it("should return workflow rules", () => {
      const rules = service.getWorkflowRules();
      expect(rules).toBe("Be helpful");
    });

    it("should return workflow prompt", () => {
      const prompt = service.getWorkflowPrompt();
      expect(prompt).toBe("You are a helpful assistant.");
    });
  });

  describe("inactive workflow state getters", () => {
    beforeEach(() => {
      // Initialize with no workflow
      service.initialize();
    });

    it("should return null for workflow file when inactive", () => {
      const workflowFile = service.getWorkflowFile();
      expect(workflowFile).toBeNull();
    });

    it("should return null for workflow when inactive", () => {
      const workflow = service.getWorkflow();
      expect(workflow).toBeNull();
    });

    it("should return false for active status when inactive", () => {
      const isActive = service.isWorkflowActive();
      expect(isActive).toBe(false);
    });

    it("should return undefined for model when inactive", () => {
      const model = service.getWorkflowModel();
      expect(model).toBeUndefined();
    });

    it("should return undefined for tools when inactive", () => {
      const tools = service.getWorkflowTools();
      expect(tools).toBeUndefined();
    });

    it("should return undefined for rules when inactive", () => {
      const rules = service.getWorkflowRules();
      expect(rules).toBeUndefined();
    });

    it("should return undefined for prompt when inactive", () => {
      const prompt = service.getWorkflowPrompt();
      expect(prompt).toBeUndefined();
    });
  });

  describe("partial workflow data", () => {
    it("should handle workflow with only name and prompt", async () => {
      const mockWorkflowFile = {
        name: "Simple Workflow",
        prompt: "Simple prompt",
      };

      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await service.initialize("owner/simple");

      expect(service.getWorkflowModel()).toBeUndefined();
      expect(service.getWorkflowTools()).toBeUndefined();
      expect(service.getWorkflowRules()).toBeUndefined();
      expect(service.getWorkflowPrompt()).toBe("Simple prompt");
      expect(service.isWorkflowActive()).toBe(true);
    });

    it("should handle workflow with empty prompt", async () => {
      const mockWorkflowFile = {
        name: "Empty Prompt Workflow",
        model: "gpt-3.5-turbo",
        prompt: "",
      };

      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await service.initialize("owner/empty");

      expect(service.getWorkflowModel()).toBe("gpt-3.5-turbo");
      expect(service.getWorkflowPrompt()).toBe("");
      expect(service.isWorkflowActive()).toBe(true);
    });
  });
});

describe("workflowProcessor", () => {
  it("should have correct type and extensions", () => {
    expect(workflowProcessor.type).toBe("prompt");
    expect(workflowProcessor.expectedFileExtensions).toEqual([".md"]);
  });

  it("should parse workflow content correctly", () => {
    const content = `---
name: Test Workflow
model: gpt-4
tools: bash,read
---
You are a helpful assistant.`;

    const result = workflowProcessor.parseContent(content, "test.md");
    expect(result).toEqual({
      name: "Test Workflow",
      model: "gpt-4",
      tools: "bash,read",
      prompt: "You are a helpful assistant.",
    });
  });

  it("should validate workflow content", () => {
    const validWorkflow = {
      name: "Valid Workflow",
      prompt: "Test prompt",
    };

    const invalidWorkflow = {
      prompt: "Test prompt",
      // Missing name
    };

    expect(workflowProcessor.validateContent?.(validWorkflow)).toBe(true);
    expect(workflowProcessor.validateContent?.(invalidWorkflow as any)).toBe(
      false,
    );
  });

  it("should validate workflow with empty name as invalid", () => {
    const invalidWorkflow = {
      name: "",
      prompt: "Test prompt",
    };

    expect(workflowProcessor.validateContent?.(invalidWorkflow)).toBe(false);
  });
});
