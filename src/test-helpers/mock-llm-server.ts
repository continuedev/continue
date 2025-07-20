import * as http from "http";
import { CLITestContext } from "./cli-helpers.js";
import * as path from "path";
import * as fs from "fs/promises";

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
  options: MockLLMServerOptions = {}
): Promise<MockLLMServer> {
  const { 
    response = "Hello World!", 
    streaming = true,
    customHandler 
  } = options;
  
  const requests: MockLLMServer["requests"] = [];
  
  const server = http.createServer((req, res) => {
    // Allow custom handling
    if (customHandler) {
      customHandler(req, res);
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
        body: body ? JSON.parse(body) : null,
        timestamp: new Date(),
      };
      requests.push(requestData);
      
      // Handle chat completions endpoint
      if (req.method === "POST" && req.url === "/chat/completions") {
        const requestBody = requestData.body;
        // Find the last user message (there may be system messages before it)
        const userMessages = requestBody?.messages?.filter((m: any) => m.role === "user") || [];
        const prompt = userMessages[userMessages.length - 1]?.content || "";
        
        const responseText = typeof response === "function" ? response(prompt) : response;
        
        // Always send streaming response since the CLI expects it
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });
        
        if (streaming) {
          // Split response into chunks for more realistic streaming
          const words = responseText.split(" ");
          words.forEach((word, index) => {
            const content = index === 0 ? word : " " + word;
            res.write(`data: {"choices":[{"delta":{"content":"${content}"},"index":0}]}\n\n`);
          });
        } else {
          // Send entire response in one chunk for non-streaming mode
          res.write(`data: {"choices":[{"delta":{"content":"${responseText}"},"index":0}]}\n\n`);
        }
        
        res.write(`data: [DONE]\n\n`);
        res.end();
      } else {
        // Return 404 for other endpoints
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    });
  });
  
  // Start the server on a random port
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as any).port;
      resolve({
        server,
        port,
        url: `http://localhost:${port}`,
        requests,
      });
    });
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
  modelName: string = "gpt-4"
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
  options: MockLLMServerOptions = {}
): Promise<MockLLMServer> {
  // Create mock server
  const mockServer = await createMockLLMServer(options);
  
  // Create config file
  const configContent = createMockLLMConfig(mockServer);
  const configPath = path.join(context.testDir, "test-config.yaml");
  await fs.writeFile(configPath, configContent);
  context.configPath = configPath;
  
  // Create onboarding flag to skip onboarding
  const onboardingFlagPath = path.join(context.testDir, ".continue", ".onboarding_complete");
  await fs.mkdir(path.dirname(onboardingFlagPath), { recursive: true });
  await fs.writeFile(onboardingFlagPath, new Date().toISOString());
  
  return mockServer;
}

/**
 * Cleans up a mock LLM server
 * @param mockServer The mock server to clean up
 */
export async function cleanupMockLLMServer(mockServer: MockLLMServer): Promise<void> {
  return new Promise((resolve) => {
    mockServer.server.close(() => resolve());
  });
}