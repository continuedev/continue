import nock from "nock";
import { ChatCompletionMessageParam } from "openai/resources";

export interface MockAPIOptions {
  baseURL?: string;
  delay?: number;
  error?: boolean;
}

/**
 * Sets up mock for OpenAI API calls
 */
export function mockOpenAIChat(
  response: string,
  options: MockAPIOptions = {},
): nock.Scope {
  const {
    baseURL = "https://api.openai.com",
    delay = 0,
    error = false,
  } = options;

  const scope = nock(baseURL).post("/v1/chat/completions").delay(delay);

  if (error) {
    return scope.reply(500, { error: { message: "Internal server error" } });
  }

  return scope.reply(200, {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: Date.now(),
    model: "gpt-4",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: response,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  });
}

/**
 * Sets up mock for streaming OpenAI API calls
 */
export function mockOpenAIStream(
  chunks: string[],
  options: MockAPIOptions = {},
): nock.Scope {
  const {
    baseURL = "https://api.openai.com",
    delay = 0,
    error = false,
  } = options;

  const scope = nock(baseURL).post("/v1/chat/completions").delay(delay);

  if (error) {
    return scope.reply(500, { error: { message: "Internal server error" } });
  }

  return scope.reply(
    200,
    () => {
      // Return a stream of Server-Sent Events
      const events = chunks.map((chunk, index) => {
        const data = {
          id: `chatcmpl-test`,
          object: "chat.completion.chunk",
          created: Date.now(),
          model: "gpt-4",
          choices: [
            {
              index: 0,
              delta: {
                content: chunk,
              },
              finish_reason: index === chunks.length - 1 ? "stop" : null,
            },
          ],
        };
        return `data: ${JSON.stringify(data)}\n\n`;
      });

      events.push("data: [DONE]\n\n");
      return events.join("");
    },
    {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  );
}

/**
 * Mocks WorkOS authentication endpoints
 */
export function mockWorkOSAuth(options: {
  accessToken?: string;
  userInfo?: any;
  organizations?: any[];
  error?: boolean;
}): void {
  const {
    accessToken = "test-access-token",
    userInfo = { id: "user-123", email: "test@example.com" },
    organizations = [{ id: "org-123", name: "Test Org" }],
    error = false,
  } = options;

  // Mock token exchange
  nock("https://api.workos.com")
    .post("/user_management/authenticate")
    .reply(
      error ? 401 : 200,
      error
        ? { error: "Invalid credentials" }
        : {
            access_token: accessToken,
            user: userInfo,
          },
    );

  // Mock get user info
  nock("https://api.workos.com")
    .get("/user_management/users/me")
    .matchHeader("authorization", `Bearer ${accessToken}`)
    .reply(error ? 401 : 200, error ? { error: "Unauthorized" } : userInfo);

  // Mock list organizations
  nock("https://api.workos.com")
    .get("/user_management/organizations")
    .matchHeader("authorization", `Bearer ${accessToken}`)
    .reply(
      error ? 401 : 200,
      error
        ? { error: "Unauthorized" }
        : {
            data: organizations,
          },
    );
}

/**
 * Creates a mock configuration for testing
 */
export function createMockConfig(overrides: any = {}): any {
  return {
    name: "Test Assistant",
    model: "gpt-4",
    provider: "openai",
    apiKey: "test-api-key",
    systemMessage: "You are a helpful test assistant.",
    ...overrides,
  };
}

/**
 * Creates mock chat messages
 */
export function createMockMessages(
  count: number = 2,
): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: "You are a helpful assistant." },
  ];

  for (let i = 0; i < count; i++) {
    messages.push(
      { role: "user", content: `Test message ${i + 1}` },
      { role: "assistant", content: `Test response ${i + 1}` },
    );
  }

  return messages;
}

/**
 * Cleans up all nock interceptors
 */
export function cleanupMocks(): void {
  nock.cleanAll();
}
