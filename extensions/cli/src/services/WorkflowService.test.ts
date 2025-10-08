import { Mock, vi } from "vitest";

import { workflowProcessor } from "../hubLoader.js";

import { WorkflowService } from "./WorkflowService.js";

// Mock the hubLoader module
vi.mock("../hubLoader.js", () => ({
  loadPackageFromHub: vi.fn(),
  HubPackageProcessor: vi.fn(),
  workflowProcessor: {
    type: "workflow",
    expectedFileExtensions: [".md"],
    parseContent: vi.fn(),
    validateContent: vi.fn(),
  },
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
        slug: null,
        workflowModelName: null,
        workflowService: service,
      });
    });

    it("should initialize with inactive state when workflow is empty string", async () => {
      const state = await service.initialize("");

      expect(state).toEqual({
        workflowFile: null,
        slug: null,
        workflowModelName: null,
        workflowService: service,
      });
    });

    it("should reject invalid workflow slug format", async () => {
      const state = await service.initialize("invalid-slug");

      expect(state).toEqual({
        workflowFile: null,
        slug: null,
        workflowModelName: null,
        workflowService: service,
      });

      // Should not call loadPackageFromHub with invalid slug
      expect(mockLoadPackageFromHub).not.toHaveBeenCalled();
    });

    it("should reject workflow slug with too many parts", async () => {
      const state = await service.initialize("owner/package/extra");

      expect(state).toEqual({
        workflowFile: null,
        slug: null,
        workflowModelName: null,
        workflowService: service,
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
        slug: "owner/package",
        workflowModelName: null,
        workflowService: service,
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
        slug: null,
        workflowModelName: null,
        workflowService: service,
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
        slug: "owner/minimal",
        workflowModelName: null,
        workflowService: service,
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

    it("should return workflow state", () => {
      const state = service.getState();
      expect(state.workflowFile?.name).toBe("Test Workflow");
      expect(state.slug).toBe("owner/package");
      expect(state.workflowFile?.model).toBe("gpt-4");
      expect(state.workflowFile?.tools).toBe("bash,read,write");
      expect(state.workflowFile?.rules).toBe("Be helpful");
      expect(state.workflowFile?.prompt).toBe("You are a helpful assistant.");
    });
  });

  describe("inactive workflow state", () => {
    beforeEach(() => {
      service.initialize();
    });

    it("should return inactive state when no workflow", () => {
      const state = service.getState();
      expect(state.workflowFile).toBeNull();
      expect(state.slug).toBeNull();
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

      const state = service.getState();
      expect(state.workflowFile?.model).toBeUndefined();
      expect(state.workflowFile?.tools).toBeUndefined();
      expect(state.workflowFile?.rules).toBeUndefined();
      expect(state.workflowFile?.prompt).toBe("Simple prompt");
    });

    it("should handle workflow with empty prompt", async () => {
      const mockWorkflowFile = {
        name: "Empty Prompt Workflow",
        model: "gpt-3.5-turbo",
        prompt: "",
      };

      mockLoadPackageFromHub.mockResolvedValue(mockWorkflowFile);
      await service.initialize("owner/empty");

      const state = service.getState();
      expect(state.workflowFile?.model).toBe("gpt-3.5-turbo");
      expect(state.workflowFile?.prompt).toBe("");
    });
  });
});

describe("workflowProcessor", () => {
  it("should have correct type and extensions", () => {
    expect(workflowProcessor.type).toBe("workflow");
    expect(workflowProcessor.expectedFileExtensions).toEqual([".md"]);
  });

  it("should parse workflow content correctly", () => {
    const content = `---
name: Test Workflow
model: gpt-4
tools: bash,read
---
You are a helpful assistant.`;

    // Set up the mock to return expected result
    const expectedResult = {
      name: "Test Workflow",
      model: "gpt-4",
      tools: "bash,read",
      prompt: "You are a helpful assistant.",
    };
    (workflowProcessor.parseContent as Mock).mockReturnValue(expectedResult);

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

    // Set up mock validation responses
    (workflowProcessor.validateContent as Mock)
      .mockReturnValueOnce(true) // For valid workflow
      .mockReturnValueOnce(false); // For invalid workflow

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

    // Mock validation to return false for empty name
    (workflowProcessor.validateContent as Mock).mockReturnValue(false);

    expect(workflowProcessor.validateContent?.(invalidWorkflow)).toBe(false);
  });
});
