import { render } from "ink-testing-library";

// Define RenderResult type to match ink-testing-library's Instance
interface RenderResult {
  stdin: {
    write: (data: string) => void;
  };
  lastFrame: () => string | undefined;
  rerender: (element: React.ReactElement) => void;
  unmount: () => void;
}
import React from "react";
import TUIChat from "../TUIChat.js";
import { createProps } from "./TUIChat.setup.js";
import { MockRemoteServer } from "./mockRemoteServer.js";

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
  options: TestOptions = {}
) {
  const { mode = "both", serverSetup, props = {} } = options;
  const modes = mode === "both" ? ["normal", "remote"] : [mode];

  modes.forEach((testMode) => {
    describe(`[${testMode.toUpperCase()} MODE]`, () => {
      it(name, async () => {
        if (testMode === "remote") {
          // Set up remote mode
          const server = new MockRemoteServer();
          const port = await server.start();
          const remoteUrl = server.getUrl(port);

          // Apply any server setup
          if (serverSetup) {
            serverSetup(server);
          }

          let renderResult: RenderResult | null = null;
          try {
            renderResult = render(
              React.createElement(TUIChat, { ...createProps({ remoteUrl, ...props }) })
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
          let renderResult: RenderResult | null = null;
          try {
            renderResult = render(
              React.createElement(TUIChat, { ...createProps(props) })
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
  defaultOptions: TestOptions = {}
) {
  const modes = defaultOptions.mode === "both" || !defaultOptions.mode 
    ? ["normal", "remote"] 
    : [defaultOptions.mode];

  modes.forEach((mode) => {
    describe(`${suiteName} [${mode.toUpperCase()} MODE]`, () => {
      // Store original functions to restore later
      const originalRunTest = global.runTest;
      const originalDescribe = global.describe;
      
      beforeAll(() => {
        // Override runTest to only run in the current mode
        global.runTest = (name: string, testFn: any, options: TestOptions = {}) => {
          // If test specifies a mode, only run if it matches current mode
          const testMode = options.mode || "both";
          if (testMode === "both" || testMode === mode) {
            it(name, async () => {
              if (mode === "remote") {
                // Set up remote mode
                const server = new MockRemoteServer();
                const port = await server.start();
                const remoteUrl = server.getUrl(port);

                // Apply any server setup
                if (options.serverSetup) {
                  options.serverSetup(server);
                }

                let renderResult: RenderResult | null = null;
                try {
                  renderResult = render(
                    React.createElement(TUIChat, { ...createProps({ remoteUrl, ...options.props }) })
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
                let renderResult: RenderResult | null = null;
                try {
                  renderResult = render(
                    React.createElement(TUIChat, { ...createProps(options.props) })
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
        global.describe = ((name: string, fn: () => void) => {
          // Just run the function directly, don't create another describe block
          fn();
        }) as jest.Describe;
      });

      afterAll(() => {
        global.runTest = originalRunTest;
        global.describe = originalDescribe;
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
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const state = server.getState();
    if (predicate(state)) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  const finalState = server.getState();
  throw new Error(`Timeout waiting for server state: ${JSON.stringify(finalState)}`);
}

/**
 * Helper to simulate user typing and sending a message
 */
export async function sendMessage(
  ctx: TestContext,
  message: string,
  waitTime: number = 100
): Promise<void> {
  const { renderResult } = ctx;
  
  renderResult.stdin.write(message);
  renderResult.stdin.write("\r");
  
  // In remote mode, wait for the message to be processed
  if (ctx.mode === "remote" && ctx.server) {
    try {
      await waitForServerState(
        ctx.server,
        state => state.messages.some((m: any) => m.content === message && m.role === "user"),
        2000
      );
    } catch (error) {
      // If waiting fails, continue anyway - the server might be slow
      console.warn("Warning: Message might not have been processed by server:", error);
    }
    // Extra wait for UI to poll and update
    await new Promise(resolve => setTimeout(resolve, 600)); // Slightly more than polling interval
  }
  
  await new Promise(resolve => setTimeout(resolve, waitTime));
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

// Make runTest available globally for test files
declare global {
  var runTest: (name: string, testFn: (ctx: TestContext) => void | Promise<void>, options?: TestOptions) => void;
}

global.runTest = runTest;