import { render } from "ink-testing-library";
import React from "react";
import { vi } from "vitest";

import { TUIChat } from "../TUIChat.js";

import { MockRemoteServer } from "./mockRemoteServer.js";
import {
  MockApiClient,
  mockAssistant,
  MockLlmApi,
  MockMCPService,
} from "./TUIChat.setup.js";

// Shared mock FileIndex to avoid duplication
const MOCK_FILE_INDEX = {
  files: [
    { path: "README.md", displayName: "README.md" },
    { path: "src/index.ts", displayName: "src/index.ts" },
    { path: "package.json", displayName: "package.json" },
  ],
  isIndexing: false,
  error: null,
};

// Define RenderResult type to match ink-testing-library's Instance
interface RenderResult {
  stdin: {
    write: (data: string) => void;
  };
  lastFrame: () => string | undefined;
  rerender: (element: React.ReactElement) => void;
  unmount: () => void;
}

export type TestMode = "normal" | "remote" | "both";

export interface TestContext {
  mode: "normal" | "remote";
  renderResult: RenderResult;
  server?: MockRemoteServer;
  remoteUrl?: string;
}

export interface TestOptions {
  mode?: TestMode;
  serverSetup?: (server: MockRemoteServer) => void;
  props?: any;
}

/**
 * Runs a test in the specified mode(s)
 * @param name Test name
 * @param testFn Test function that receives the test context
 * @param options Test options including mode and server setup
 */
export function runTest(
  name: string,
  testFn: (ctx: TestContext) => void | Promise<void>,
  options: TestOptions = {},
) {
  const { mode = "both", serverSetup, props = {} } = options;
  const modes = mode === "both" ? ["normal", "remote"] : [mode];

  modes.forEach((testMode) => {
    describe(`[${testMode.toUpperCase()} MODE]`, () => {
      it(name, async () => {
        // Import mocks from Vitest setup
        const { useServices, useService } = await import(
          "../../hooks/useService.js"
        );
        const mockUseServices = useServices as any;
        const mockUseService = useService as any;

        if (testMode === "remote") {
          // Set up remote mode - use different mocks
          mockUseServices.mockReturnValue({
            services: {},
            loading: false,
            error: null,
            allReady: true,
          });

          mockUseService.mockReturnValue({
            value: null,
            state: "idle",
            error: null,
            reload: vi.fn(() => Promise.resolve()),
          });

          const server = new MockRemoteServer();
          const port = await server.start();
          const remoteUrl = `http://localhost:${port}`;

          // Apply any server setup
          if (serverSetup) {
            serverSetup(server);
          }

          let renderResult: RenderResult | null = null;
          try {
            renderResult = render(
              React.createElement(TUIChat, { remoteUrl, ...props }),
            ) as RenderResult;

            await testFn({
              mode: "remote",
              renderResult,
              server,
              remoteUrl,
            });
          } finally {
            // Clean up render instance first
            if (renderResult) {
              renderResult.unmount();
            }
            // Then stop the server
            await server.stop();
          }
        } else {
          // Normal mode - set up service mocks with ready services
          mockUseServices.mockReturnValue({
            services: {
              auth: { authConfig: null, isAuthenticated: false },
              config: { config: mockAssistant },
              model: {
                llmApi: new MockLlmApi(),
                model: { provider: "test", name: "test" },
              },
              mcp: { mcpService: new MockMCPService() },
              apiClient: { apiClient: new MockApiClient() },
            },
            loading: false,
            error: null,
            allReady: true,
          });

          mockUseService.mockImplementation(
            (serviceName: string) =>
              ({
                value: (() => {
                  switch (serviceName) {
                    case "auth":
                      return { authConfig: null, isAuthenticated: false };
                    case "config":
                      return { config: mockAssistant };
                    case "model":
                      return {
                        llmApi: new MockLlmApi(),
                        model: { provider: "test", name: "test" },
                      };
                    case "mcp":
                      return { mcpService: new MockMCPService() };
                    case "apiClient":
                      return { apiClient: new MockApiClient() };
                    case "fileIndex":
                      return MOCK_FILE_INDEX;
                    default:
                      return null;
                  }
                })(),
                state: "ready" as const,
                error: null,
                reload: vi.fn(() => Promise.resolve()),
              }) as any,
          );

          let renderResult: RenderResult | null = null;
          try {
            renderResult = render(
              React.createElement(TUIChat, { ...props }),
            ) as RenderResult;

            await testFn({
              mode: "normal",
              renderResult,
            });
          } finally {
            // Clean up render instance
            if (renderResult) {
              renderResult.unmount();
            }
          }
        }
      });
    });
  });
}

/**
 * Runs a test suite in the specified mode(s)
 * @param suiteName Suite name
 * @param suiteFn Suite function that can use runTest
 * @param defaultOptions Default options for all tests in the suite
 */
export function runTestSuite(
  suiteName: string,
  suiteFn: () => void,
  defaultOptions: TestOptions = {},
) {
  const modes =
    defaultOptions.mode === "both" || !defaultOptions.mode
      ? ["normal", "remote"]
      : [defaultOptions.mode];

  modes.forEach((mode) => {
    describe(`${suiteName} [${mode.toUpperCase()} MODE]`, () => {
      // Store original functions to restore later
      const originalRunTest = global.runTest;
      const originalDescribe = (global as any).describe;

      beforeAll(async () => {
        const { useServices, useService } = await import(
          "../../hooks/useService.js"
        );
        const mockUseServices = useServices as any;
        const mockUseService = useService as any;

        // Override runTest to only run in the current mode
        global.runTest = (
          name: string,
          testFn: any,
          options: TestOptions = {},
        ) => {
          // If test specifies a mode, only run if it matches current mode
          const testMode = options.mode || "both";
          if (testMode === "both" || testMode === mode) {
            it(name, async () => {
              if (mode === "remote") {
                // Set up remote mode
                mockUseServices.mockReturnValue({
                  services: {},
                  loading: false,
                  error: null,
                  allReady: true,
                });

                mockUseService.mockReturnValue({
                  value: null,
                  state: "idle",
                  error: null,
                  reload: vi.fn(() => Promise.resolve()),
                });

                const server = new MockRemoteServer();
                const port = await server.start();
                const remoteUrl = `http://localhost:${port}`;

                // Apply any server setup
                if (options.serverSetup) {
                  options.serverSetup(server);
                }

                let renderResult: RenderResult | null = null;
                try {
                  renderResult = render(
                    React.createElement(TUIChat, {
                      remoteUrl,
                      ...options.props,
                    }),
                  ) as RenderResult;

                  await testFn({
                    mode: "remote",
                    renderResult,
                    server,
                    remoteUrl,
                  });
                } finally {
                  // Clean up render instance first
                  if (renderResult) {
                    renderResult.unmount();
                  }
                  // Then stop the server
                  await server.stop();
                }
              } else {
                // Normal mode
                mockUseServices.mockReturnValue({
                  services: {
                    auth: { authConfig: null, isAuthenticated: false },
                    config: { config: mockAssistant },
                    model: {
                      llmApi: new MockLlmApi(),
                      model: { provider: "test", name: "test" },
                    },
                    mcp: { mcpService: new MockMCPService() },
                    apiClient: { apiClient: new MockApiClient() },
                  },
                  loading: false,
                  error: null,
                  allReady: true,
                });

                mockUseService.mockImplementation(
                  (serviceName: string) =>
                    ({
                      value: (() => {
                        switch (serviceName) {
                          case "auth":
                            return { authConfig: null, isAuthenticated: false };
                          case "config":
                            return { config: mockAssistant };
                          case "model":
                            return {
                              llmApi: new MockLlmApi(),
                              model: { provider: "test", name: "test" },
                            };
                          case "mcp":
                            return { mcpService: new MockMCPService() };
                          case "apiClient":
                            return { apiClient: new MockApiClient() };
                          case "fileIndex":
                            return MOCK_FILE_INDEX;
                          default:
                            return null;
                        }
                      })(),
                      state: "ready" as const,
                      error: null,
                      reload: vi.fn(() => Promise.resolve()),
                    }) as any,
                );

                let renderResult: RenderResult | null = null;
                try {
                  renderResult = render(
                    React.createElement(TUIChat, { ...options.props }),
                  ) as RenderResult;

                  await testFn({
                    mode: "normal",
                    renderResult,
                  });
                } finally {
                  // Clean up render instance
                  if (renderResult) {
                    renderResult.unmount();
                  }
                }
              }
            });
          }
        };

        // Override describe to prevent nested mode descriptions
        (global as any).describe = ((name: string, fn: () => void) => {
          // Just run the function directly, don't create another describe block
          fn();
        }) as any;
      });

      afterAll(() => {
        global.runTest = originalRunTest;
        (global as any).describe = originalDescribe;
      });

      suiteFn();
    });
  });
}

/**
 * Helper to wait for server state changes in remote mode
 */
export async function waitForServerState(
  server: MockRemoteServer,
  predicate: (state: any) => boolean,
  timeout: number = 5000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const state = (server as any).state || {};
    if (predicate(state)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const finalState = (server as any).state || {};
  throw new Error(
    `Timeout waiting for server state: ${JSON.stringify(finalState)}`,
  );
}

/**
 * Helper to simulate user typing and sending a message
 */
export async function sendMessage(
  ctx: TestContext,
  message: string,
  waitTime: number = 100,
): Promise<void> {
  const { renderResult } = ctx;

  renderResult.stdin.write(message);
  renderResult.stdin.write("\r");

  // In remote mode, wait for the message to be processed
  if (ctx.mode === "remote" && ctx.server) {
    try {
      await waitForServerState(
        ctx.server,
        (state) =>
          state.messages?.some?.(
            (m: any) => m.content === message && m.role === "user",
          ),
        2000,
      );
    } catch (error) {
      // If waiting fails, continue anyway - the server might be slow
      console.warn(
        "Warning: Message might not have been processed by server:",
        error,
      );
    }
    // Extra wait for UI to poll and update
    await new Promise((resolve) => setTimeout(resolve, 600)); // Slightly more than polling interval
  }

  await new Promise((resolve) => setTimeout(resolve, waitTime));
}

/**
 * Helper to wait for next render cycle to complete
 * Use this after stdin.write() to ensure at least one render has occurred
 * This prevents flaky tests caused by calling lastFrame() before React renders
 */
export async function waitForNextRender(): Promise<void> {
  // Wait for multiple ticks to ensure render completes
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  // Add a delay to allow Ink terminal UI to render
  // CI environments are slower, so we need a longer delay
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Helper to check if UI shows remote mode indicators
 */
export function expectRemoteMode(frame: string | undefined) {
  if (!frame) throw new Error("Frame is undefined");

  // Should show cyan color and remote indicator
  expect(frame).toContain("◉");
  expect(frame).toContain("Remote Mode");
}

/**
 * Helper to check if UI shows normal mode indicators
 */
export function expectNormalMode(frame: string | undefined) {
  if (!frame) throw new Error("Frame is undefined");

  // Should show normal indicator
  expect(frame).toContain("●");
  expect(frame).toContain("Continue CLI");
}

/**
 * Helper to wait for a condition to be true
 * similar to `waitFor` in testing libraries
 */
export async function waitForCondition(
  conditionFn: () => boolean,
  timeoutMs = 2000,
  intervalMs = 50,
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (conditionFn()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// Make runTest available globally for test files
declare global {
  var runTest: (
    name: string,
    testFn: (ctx: TestContext) => void | Promise<void>,
    options?: TestOptions,
  ) => void;
}

global.runTest = runTest;
