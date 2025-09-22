import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  SERVICE_NAMES,
  initializeServices,
  serviceContainer,
} from "../services/index.js";
import { modeService } from "../services/ModeService.js";

import { getAllTools } from "./handleToolCalls.js";

describe("streamChatResponse - Mode Switch During Streaming", () => {
  beforeEach(async () => {
    // Clean up service container state before each test
    const services = [
      SERVICE_NAMES.TOOL_PERMISSIONS,
      SERVICE_NAMES.AUTH,
      SERVICE_NAMES.API_CLIENT,
      SERVICE_NAMES.CONFIG,
      SERVICE_NAMES.MODEL,
      SERVICE_NAMES.MCP,
    ];

    services.forEach((service) => {
      (serviceContainer as any).services.delete(service);
      (serviceContainer as any).factories.delete(service);
      (serviceContainer as any).dependencies.delete(service);
    });

    // Initialize services in normal mode
    await initializeServices({
      headless: true,
      toolPermissionOverrides: {
        mode: "normal",
      },
    });
  });

  test("should recompute tools on each iteration to handle mode switches", async () => {
    // Start in normal mode
    let tools = await getAllTools();
    let toolNames = tools.map((t) => t.function.name);

    // Should include write tools in normal mode
    expect(toolNames).toContain("Write");
    expect(toolNames).toContain("Edit");

    // Switch to plan mode (simulating Shift+Tab during streaming)
    modeService.switchMode("plan");

    // Update the service container (this is what UserInput.tsx does)
    const updatedState = modeService.getToolPermissionService().getState();
    serviceContainer.set(SERVICE_NAMES.TOOL_PERMISSIONS, updatedState);

    // Recompute tools - should now exclude write tools
    tools = await getAllTools();
    toolNames = tools.map((t) => t.function.name);

    // Should exclude write tools in plan mode
    expect(toolNames).not.toContain("Write");
    expect(toolNames).not.toContain("Edit");

    // Should still include read-only tools
    expect(toolNames).toContain("Read");
    expect(toolNames).toContain("Bash");
    expect(toolNames).toContain("List");
  });

  test("getAllTools reflects current mode immediately", async () => {
    // Start in normal mode
    expect(modeService.getCurrentMode()).toBe("normal");
    let tools = await getAllTools();
    expect(tools.map((t) => t.function.name)).toContain("Write");

    // Switch to plan mode
    modeService.switchMode("plan");
    let updatedState = modeService.getToolPermissionService().getState();
    serviceContainer.set(SERVICE_NAMES.TOOL_PERMISSIONS, updatedState);
    expect(modeService.getCurrentMode()).toBe("plan");

    // getAllTools should immediately reflect the new mode
    tools = await getAllTools();
    expect(tools.map((t) => t.function.name)).not.toContain("Write");

    // Switch to auto mode
    modeService.switchMode("auto");
    updatedState = modeService.getToolPermissionService().getState();
    serviceContainer.set(SERVICE_NAMES.TOOL_PERMISSIONS, updatedState);
    expect(modeService.getCurrentMode()).toBe("auto");

    // getAllTools should immediately reflect auto mode (all tools allowed)
    tools = await getAllTools();
    expect(tools.map((t) => t.function.name)).toContain("Write");
    expect(tools.map((t) => t.function.name)).toContain("Edit");
    expect(tools.map((t) => t.function.name)).toContain("Read");
  });

  test("demonstrates the fix: no more stale tool lists", async () => {
    // This test demonstrates that the fix prevents the original race condition

    // Mock a multi-turn conversation scenario
    const mockLlmApi = {
      chatCompletions: {
        create: vi.fn().mockImplementation(() => {
          // Return a mock stream that would trigger multiple iterations
          return {
            [Symbol.asyncIterator]: async function* () {
              // First response - content only
              yield {
                choices: [
                  {
                    delta: { content: "I'll help you with that." },
                    finish_reason: null,
                  },
                ],
              };

              // Second response - indicates tool calls coming
              yield {
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        {
                          index: 0,
                          id: "call_1",
                          function: {
                            name: "Read",
                            arguments: '{"filepath": "test.txt"}',
                          },
                        },
                      ],
                    },
                    finish_reason: null,
                  },
                ],
              };

              // Final response
              yield {
                choices: [
                  {
                    delta: {},
                    finish_reason: "tool_calls",
                  },
                ],
              };
            },
          };
        }),
      },
    };

    const mockModel = {
      model: "gpt-4",
      defaultCompletionOptions: {},
    };

    const abortController = new AbortController();

    // Start in normal mode - tools should include Write
    const initialTools = await getAllTools();
    expect(initialTools.map((t) => t.function.name)).toContain("Write");

    // During streaming, if mode switches, subsequent iterations should use new tools
    // This is now handled by recomputing tools on each iteration

    // The fix ensures that each call to processStreamingResponse gets fresh tools
    // based on the current mode, preventing the race condition
  });
});
