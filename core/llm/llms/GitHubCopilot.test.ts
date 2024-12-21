import { jest } from "@jest/globals";
import GitHubCopilot from "./GitHubCopilot";
import { CompletionRequest, CompletionResponse } from "../index";

describe("GitHubCopilot", () => {
  let copilot: GitHubCopilot;

  beforeEach(() => {
    copilot = new GitHubCopilot({
      apiKey: "test-api-key",
    });
  });

  test("should have providerName as 'github-copilot'", () => {
    expect(GitHubCopilot.providerName).toBe("github-copilot");
  });

  test("should stream completion from GitHub Copilot API", async () => {
    const mockResponse = {
      choices: [
        {
          text: "This is a test completion.",
        },
      ],
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => {
            let done = false;
            return {
              read: () =>
                Promise.resolve({
                  value: new TextEncoder().encode(JSON.stringify(mockResponse)),
                  done,
                }),
            };
          },
        },
      }),
    ) as jest.Mock;

    const request: CompletionRequest = {
      prompt: "Test prompt",
      max_tokens: 10,
    };

    const responses: CompletionResponse[] = [];
    for await (const response of copilot._streamComplete(request)) {
      responses.push(response);
    }

    expect(responses).toHaveLength(1);
    expect(responses[0].choices[0].text).toBe("This is a test completion.");
  });

  test("should throw error if GitHub Copilot API response is not ok", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        statusText: "Bad Request",
      }),
    ) as jest.Mock;

    const request: CompletionRequest = {
      prompt: "Test prompt",
      max_tokens: 10,
    };

    await expect(async () => {
      for await (const _ of copilot._streamComplete(request)) {
        // do nothing
      }
    }).rejects.toThrow("GitHub Copilot API error: Bad Request");
  });

  test("should throw error if no response body from GitHub Copilot API", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        body: null,
      }),
    ) as jest.Mock;

    const request: CompletionRequest = {
      prompt: "Test prompt",
      max_tokens: 10,
    };

    await expect(async () => {
      for await (const _ of copilot._streamComplete(request)) {
        // do nothing
      }
    }).rejects.toThrow("No response body from GitHub Copilot API");
  });

  test("should stream chat from GitHub Copilot API", async () => {
    const mockResponse = {
      choices: [
        {
          delta: {
            content: "This is a test chat response.",
          },
        },
      ],
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => {
            let done = false;
            return {
              read: () =>
                Promise.resolve({
                  value: new TextEncoder().encode(JSON.stringify(mockResponse)),
                  done,
                }),
            };
          },
        },
      }),
    ) as jest.Mock;

    const messages = [{ role: "user", content: "Test message" }];

    const responses: any[] = [];
    for await (const response of copilot._streamChat(messages, new AbortController().signal, {})) {
      responses.push(response);
    }

    expect(responses).toHaveLength(1);
    expect(responses[0].content).toBe("This is a test chat response.");
  });

  test("should throw error if GitHub Copilot API response is not ok for chat", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        statusText: "Bad Request",
      }),
    ) as jest.Mock;

    const messages = [{ role: "user", content: "Test message" }];

    await expect(async () => {
      for await (const _ of copilot._streamChat(messages, new AbortController().signal, {})) {
        // do nothing
      }
    }).rejects.toThrow("GitHub Copilot API error: Bad Request");
  });

  test("should throw error if no response body from GitHub Copilot API for chat", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        body: null,
      }),
    ) as jest.Mock;

    const messages = [{ role: "user", content: "Test message" }];

    await expect(async () => {
      for await (const _ of copilot._streamChat(messages, new AbortController().signal, {})) {
        // do nothing
      }
    }).rejects.toThrow("No response body from GitHub Copilot API");
  });
});
