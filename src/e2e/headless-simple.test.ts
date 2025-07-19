import { createTestContext, cleanupTestContext, runCLI, createTestConfig } from "../test-helpers/cli-helpers.js";
import { mockLLMResponse, mockLLMStreamResponse, mockLLMError, clearLLMMocks } from "../test-helpers/adapter-mocks.js";
import { createMockConfig } from "../test-helpers/mock-helpers.js";

describe("E2E: Headless Mode (Simple)", () => {
  let context: any;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    clearLLMMocks();
    await cleanupTestContext(context);
  });

  describe("basic headless functionality", () => {
    it("should output response and exit with -p flag", async () => {
      // Create a minimal config file
      const config = {
        name: "Test Assistant",
        model: "gpt-4",
        provider: "openai",
        apiKey: "test-key",
      };
      await createTestConfig(context, `name: Test Assistant
model: gpt-4  
provider: openai
apiKey: test-key`);
      
      // Mock the LLM response at the adapter level
      mockLLMResponse("Hello! This is a test response from the mocked LLM.");
      
      const result = await runCLI(context, {
        args: ["-p", "Hello, AI!", "--config", context.configPath],
        env: { OPENAI_API_KEY: "test-key" },
      });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Hello! This is a test response from the mocked LLM.");
    });

    it("should handle streaming responses in headless mode", async () => {
      const config = {
        name: "Test Assistant", 
        model: "gpt-4",
        provider: "openai",
        apiKey: "test-key",
      };
      await createTestConfig(context, `name: Test Assistant
model: gpt-4
provider: openai  
apiKey: test-key`);
      
      // Mock streaming response with chunks
      mockLLMStreamResponse(["Hello", " from", " streaming", " response!"]);
      
      const result = await runCLI(context, {
        args: ["-p", "Test streaming", "--config", context.configPath],
        env: { OPENAI_API_KEY: "test-key" },
      });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Hello from streaming response!");
    });

    it("should handle errors gracefully in headless mode", async () => {
      const config = {
        name: "Test Assistant",
        model: "gpt-4", 
        provider: "openai",
        apiKey: "test-key",
      };
      await createTestConfig(context, `name: Test Assistant
model: gpt-4
provider: openai
apiKey: test-key`);
      
      // Mock an error at the adapter level
      mockLLMError("Connection timeout");
      
      const result = await runCLI(context, {
        args: ["-p", "This should fail", "--config", context.configPath],
        env: { OPENAI_API_KEY: "test-key" },
        expectError: true,
      });
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr || result.stdout).toContain("error");
    });

    it("should work with minimal config", async () => {
      // Test with the most minimal config possible
      await createTestConfig(context, `model: gpt-4
provider: openai`);
      
      mockLLMResponse("Response with minimal config");
      
      const result = await runCLI(context, {
        args: ["-p", "Test minimal", "--config", context.configPath],
        env: { OPENAI_API_KEY: "env-key" }, // API key from environment
      });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Response with minimal config");
    });

    it("should handle empty prompt appropriately", async () => {
      const config = {
        name: "Test Assistant",
        model: "gpt-4",
        provider: "openai", 
        apiKey: "test-key",
      };
      await createTestConfig(context, `name: Test Assistant
model: gpt-4
provider: openai
apiKey: test-key`);
      
      const result = await runCLI(context, {
        args: ["-p", "--config", context.configPath],
        env: { OPENAI_API_KEY: "test-key" },
        expectError: true,
      });
      
      // Should error or show help when no prompt provided
      expect(result.exitCode).not.toBe(0);
    });
  });
});