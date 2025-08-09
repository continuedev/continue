import * as fs from "fs/promises";
import * as http from "http";
import * as path from "path";

import { CLITestContext } from "./cli-helpers.js";

export interface MockLLMServerOptions {
  /** The response to send for chat completions. Can be a string or a function that returns a response based on the request. */
  response?: string | ((prompt: string) => string);
  /** Whether to stream the response word by word (true) or send it all at once (false). Default: true
   * Note: The response format is always SSE since the CLI expects streaming responses. */
  streaming?: boolean;
  /** Custom handler for requests */
  customHandler?: (req: http.IncomingMessage, res: http.ServerResponse) => void;
}

export interface MockLLMServer {
  server: http.Server;
  port: number;
  url: string;
  /** Track requests received by the server */
  requests: Array<{
    method: string;
    url: string;
    body: any;
    timestamp: Date;
  }>;
}

/**
 * Creates a mock LLM server for testing
 * @param options Configuration options for the mock server
 * @returns A promise that resolves to the mock server instance
 */
export async function createMockLLMServer(
  options: MockLLMServerOptions = {},
): Promise<MockLLMServer> {
  const {
    response = "Hello World!",
    streaming = true,
    customHandler,
  } = options;

  const requests: MockLLMServer["requests"] = [];

  const server = http.createServer((req, res) => {
    // Allow custom handling
    if (customHandler) {
      customHandler(req, res);
      return;
    }

    // Set CORS headers to prevent any potential browser-related issues
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Collect request body
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      // Track the request
      const requestData = {
        method: req.method || "",
        url: req.url || "",
        body: body
          ? (() => {
              try {
                return JSON.parse(body);
              } catch {
                return body;
              }
            })()
          : null,
        timestamp: new Date(),
      };
      requests.push(requestData);

      // Handle chat completions endpoint
      if (req.method === "POST" && req.url === "/chat/completions") {
        const requestBody = requestData.body;
        // Find the last user message (there may be system messages before it)
        const userMessages =
          requestBody?.messages?.filter((m: any) => m.role === "user") || [];
        const prompt = userMessages[userMessages.length - 1]?.content || "";

        const responseText =
          typeof response === "function" ? response(prompt) : response;

        // Always send streaming response since the CLI expects it
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });

        if (streaming) {
          // Split response into chunks for more realistic streaming
          const words = responseText.split(" ");
          words.forEach((word, index) => {
            const content = index === 0 ? word : " " + word;
            // Properly escape JSON content
            const escapedContent = JSON.stringify(content).slice(1, -1);
            res.write(
              `data: {"choices":[{"delta":{"content":"${escapedContent}"},"index":0}]}\n\n`,
            );
          });
        } else {
          // Send entire response in one chunk for non-streaming mode
          // Properly escape JSON content
          const escapedContent = JSON.stringify(responseText).slice(1, -1);
          res.write(
            `data: {"choices":[{"delta":{"content":"${escapedContent}"},"index":0}]}\n\n`,
          );
        }

        res.write(`data: [DONE]\n\n`);
        res.end();
      } else {
        // Return 404 for other endpoints
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    });

    // Handle connection errors gracefully
    req.on("error", (err) => {
      console.error("Request error:", err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    });
  });

  // Handle server errors
  server.on("error", (err) => {
    console.error("Server error:", err);
  });

  // Set keep-alive timeout to help with cleanup
  server.keepAliveTimeout = 1000;
  server.headersTimeout = 2000;

  // Start the server on a random port
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to get server address"));
        return;
      }

      // Use unref() to prevent keeping the process alive unnecessarily
      server.unref();

      resolve({
        server,
        port: address.port,
        url: `http://127.0.0.1:${address.port}`,
        requests,
      });
    });

    server.on("error", reject);
  });
}

/**
 * Creates a test configuration that uses a mock LLM server
 * @param context The test context
 * @param mockServer The mock server instance
 * @param modelName The model name to use (default: "gpt-4")
 * @returns The configuration content as a string
 */
export function createMockLLMConfig(
  mockServer: MockLLMServer,
  modelName: string = "gpt-4",
): string {
  return `name: Test Assistant
version: 1.0.0
schema: v1
models:
  - name: test-${modelName}
    model: ${modelName}
    provider: openai
    apiKey: test-key
    apiBase: ${mockServer.url}
    roles:
      - chat
`;
}

/**
 * Sets up a complete test environment with a mock LLM server
 * @param context The test context
 * @param options Options for the mock server
 * @returns A promise that resolves to the mock server instance
 */
export async function setupMockLLMTest(
  context: CLITestContext,
  options: MockLLMServerOptions = {},
): Promise<MockLLMServer> {
  // Create mock server
  const mockServer = await createMockLLMServer(options);

  // Create config file
  const configContent = createMockLLMConfig(mockServer);
  const configPath = path.join(context.testDir, "test-config.yaml");
  await fs.writeFile(configPath, configContent);
  context.configPath = configPath;

  // Create onboarding flag to skip onboarding
  const onboardingFlagPath = path.join(
    context.testDir,
    ".continue",
    ".onboarding_complete",
  );
  await fs.mkdir(path.dirname(onboardingFlagPath), { recursive: true });
  await fs.writeFile(onboardingFlagPath, new Date().toISOString());

  return mockServer;
}

/**
 * Cleans up a mock LLM server
 * @param mockServer The mock server to clean up
 */
export async function cleanupMockLLMServer(
  mockServer: MockLLMServer,
): Promise<void> {
  return new Promise((resolve) => {
    if (!mockServer?.server) {
      resolve();
      return;
    }

    let resolved = false;
    const resolveOnce = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    // Destroy all active connections immediately
    if (typeof mockServer.server.closeAllConnections === "function") {
      mockServer.server.closeAllConnections();
    }

    // Set a shorter keep-alive timeout before closing
    mockServer.server.keepAliveTimeout = 0;
    mockServer.server.headersTimeout = 0;

    // Try to close the server gracefully first
    if (mockServer.server.listening) {
      mockServer.server.close((err: any) => {
        if (err && err.code !== "ERR_SERVER_NOT_RUNNING") {
          console.error("Error closing mock server:", err);
        }
        resolveOnce();
      });

      // Force close after a short timeout
      setTimeout(() => {
        if (mockServer.server.listening) {
          mockServer.server.closeAllConnections?.();
          // Use unref to prevent keeping the process alive
          mockServer.server.unref();
        }
        resolveOnce();
      }, 100);
    } else {
      resolveOnce();
    }

    // Fallback timeout to ensure cleanup doesn't hang
    setTimeout(resolveOnce, 200);
  });
}
