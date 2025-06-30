import * as followRedirects from "follow-redirects";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AgentPool } from "./agentPool.js";
import {
  getAgentOptions,
  getUniqueAgentRequestOptionsKey,
} from "./getAgentOptions.js";

// Mock dependencies
vi.mock("follow-redirects", () => {
  return {
    default: {
      http: {
        Agent: vi.fn().mockImplementation(function () {
          this.destroy = vi.fn();
          return this;
        }),
      },
      https: {
        Agent: vi.fn().mockImplementation(function () {
          this.destroy = vi.fn();
          return this;
        }),
      },
    },
  };
});

vi.mock("http-proxy-agent", () => {
  return {
    HttpProxyAgent: vi.fn().mockImplementation(function () {
      this.destroy = vi.fn();
      return this;
    }),
  };
});

vi.mock("https-proxy-agent", () => {
  return {
    HttpsProxyAgent: vi.fn().mockImplementation(function () {
      this.destroy = vi.fn();
      return this;
    }),
  };
});

vi.mock("./getAgentOptions.js", () => {
  return {
    getAgentOptions: vi.fn().mockResolvedValue({}),
    getUniqueAgentRequestOptionsKey: vi
      .fn()
      .mockReturnValue("default-options-key"),
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  // Reset mocks
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  // Clear the singleton instance
  const agentPool = AgentPool.getInstance();
  agentPool.clear();
});

test("AgentPool.getInstance should return the same instance", () => {
  const instance1 = AgentPool.getInstance();
  const instance2 = AgentPool.getInstance();

  expect(instance1).toBe(instance2);
});

test("getOrCreateAgent should create an HTTP agent when protocol is http", async () => {
  const agentPool = new AgentPool();
  const url = new URL("http://example.com");

  const agent = await agentPool.getOrCreateAgent(url, undefined, undefined);

  expect(followRedirects.default.http.Agent).toHaveBeenCalled();
  expect(agent).toBeDefined();
});

test("getOrCreateAgent should create an HTTPS agent when protocol is https", async () => {
  const agentPool = new AgentPool();
  const url = new URL("https://example.com");

  const agent = await agentPool.getOrCreateAgent(url, undefined, undefined);

  expect(followRedirects.default.https.Agent).toHaveBeenCalled();
  expect(agent).toBeDefined();
});

test("getOrCreateAgent should create an HTTP proxy agent when protocol is http and proxy is defined", async () => {
  const agentPool = new AgentPool();
  const url = new URL("http://example.com");
  const proxy = "http://proxy.example.com:8080";

  const agent = await agentPool.getOrCreateAgent(url, proxy, undefined);

  expect(HttpProxyAgent).toHaveBeenCalledWith(proxy, expect.anything());
  expect(agent).toBeDefined();
});

test("getOrCreateAgent should create an HTTPS proxy agent when protocol is https and proxy is defined", async () => {
  const agentPool = new AgentPool();
  const url = new URL("https://example.com");
  const proxy = "http://proxy.example.com:8080";

  const agent = await agentPool.getOrCreateAgent(url, proxy, undefined);

  expect(HttpsProxyAgent).toHaveBeenCalledWith(proxy, expect.anything());
  expect(agent).toBeDefined();
});

test("getOrCreateAgent should reuse cached agent for the same protocol, proxy, and options", async () => {
  const agentPool = new AgentPool();
  const url = new URL("https://example.com");

  const agent1 = await agentPool.getOrCreateAgent(url, undefined, undefined);
  const agent2 = await agentPool.getOrCreateAgent(url, undefined, undefined);

  expect(agent1).toBe(agent2);
  expect(followRedirects.default.https.Agent).toHaveBeenCalledTimes(1);
});

test("getOrCreateAgent should create different agents for different protocols", async () => {
  const agentPool = new AgentPool();
  const httpUrl = new URL("http://example.com");
  const httpsUrl = new URL("https://example.com");

  const httpAgent = await agentPool.getOrCreateAgent(
    httpUrl,
    undefined,
    undefined,
  );
  const httpsAgent = await agentPool.getOrCreateAgent(
    httpsUrl,
    undefined,
    undefined,
  );

  expect(httpAgent).not.toBe(httpsAgent);
  expect(followRedirects.default.http.Agent).toHaveBeenCalledTimes(1);
  expect(followRedirects.default.https.Agent).toHaveBeenCalledTimes(1);
});

test("getOrCreateAgent should create different agents for different proxies", async () => {
  const agentPool = new AgentPool();
  const url = new URL("https://example.com");
  const proxy1 = "http://proxy1.example.com:8080";
  const proxy2 = "http://proxy2.example.com:8080";

  const agent1 = await agentPool.getOrCreateAgent(url, proxy1, undefined);
  const agent2 = await agentPool.getOrCreateAgent(url, proxy2, undefined);

  expect(agent1).not.toBe(agent2);
  expect(HttpsProxyAgent).toHaveBeenCalledTimes(2);
});

test("getOrCreateAgent should create different agents for different request options", async () => {
  const agentPool = new AgentPool();
  const url = new URL("https://example.com");
  const options1 = { timeout: 1000 };
  const options2 = { timeout: 2000 };

  // Mock different keys for different options
  vi.mocked(getUniqueAgentRequestOptionsKey).mockImplementation((options) =>
    options?.timeout === 1000 ? "options-key-1" : "options-key-2",
  );

  const agent1 = await agentPool.getOrCreateAgent(url, undefined, options1);
  const agent2 = await agentPool.getOrCreateAgent(url, undefined, options2);

  expect(agent1).not.toBe(agent2);
  expect(followRedirects.default.https.Agent).toHaveBeenCalledTimes(2);
});

test("agents should be destroyed and removed from cache after TTL", async () => {
  const ttl = 1000; // 1 second
  const agentPool = new AgentPool(ttl);
  const url = new URL("https://example.com");

  const agent = await agentPool.getOrCreateAgent(url, undefined, undefined);

  // Fast-forward time past the TTL
  vi.advanceTimersByTime(ttl + 100);

  // The agent should have been destroyed
  expect(agent.destroy).toHaveBeenCalled();

  // Requesting again should create a new agent
  const newAgent = await agentPool.getOrCreateAgent(url, undefined, undefined);
  expect(newAgent).not.toBe(agent);
  expect(followRedirects.default.https.Agent).toHaveBeenCalledTimes(2);
});

test("clear() should destroy all agents and clear the cache", async () => {
  const agentPool = new AgentPool();
  const httpUrl = new URL("http://example.com");
  const httpsUrl = new URL("https://example.com");

  const httpAgent = await agentPool.getOrCreateAgent(
    httpUrl,
    undefined,
    undefined,
  );
  const httpsAgent = await agentPool.getOrCreateAgent(
    httpsUrl,
    undefined,
    undefined,
  );

  agentPool.clear();

  expect(httpAgent.destroy).toHaveBeenCalled();
  expect(httpsAgent.destroy).toHaveBeenCalled();

  // Requesting again should create new agents
  const newHttpAgent = await agentPool.getOrCreateAgent(
    httpUrl,
    undefined,
    undefined,
  );
  expect(newHttpAgent).not.toBe(httpAgent);
});

test("concurrent requests for the same agent should all resolve to the same agent", async () => {
  const agentPool = new AgentPool();
  const url = new URL("https://example.com");

  // Create a delayed getAgentOptions function to simulate a slow operation
  vi.mocked(getAgentOptions).mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve({}), 100)),
  );

  // Make multiple concurrent requests
  const promise1 = agentPool.getOrCreateAgent(url, undefined, undefined);
  const promise2 = agentPool.getOrCreateAgent(url, undefined, undefined);
  const promise3 = agentPool.getOrCreateAgent(url, undefined, undefined);

  // Advance time to resolve the getAgentOptions promise
  vi.advanceTimersByTime(200);

  // All promises should resolve to the same agent
  const [agent1, agent2, agent3] = await Promise.all([
    promise1,
    promise2,
    promise3,
  ]);

  expect(agent1).toBe(agent2);
  expect(agent2).toBe(agent3);
  expect(followRedirects.default.https.Agent).toHaveBeenCalledTimes(1);
});

test("agent creation failure should reject all pending requests", async () => {
  const agentPool = new AgentPool();
  const url = new URL("https://example.com");

  // Force agent creation to fail
  const error = new Error("Agent creation failed");
  vi.mocked(getAgentOptions).mockRejectedValue(error);

  // Make multiple concurrent requests
  const promise1 = agentPool.getOrCreateAgent(url, undefined, undefined);
  const promise2 = agentPool.getOrCreateAgent(url, undefined, undefined);

  // All promises should be rejected with the same error
  await expect(promise1).rejects.toThrow("Agent creation failed");
  await expect(promise2).rejects.toThrow("Agent creation failed");
});

test("agent TTL should be extended when agent is reused", async () => {
  // Reset mocks specifically for this test
  vi.mocked(getAgentOptions).mockResolvedValue({});

  const ttl = 1000; // 1 second
  const agentPool = new AgentPool(ttl);
  const url = new URL("https://example.com");

  const agent = await agentPool.getOrCreateAgent(url, undefined, undefined);

  // Fast-forward time halfway through TTL
  vi.advanceTimersByTime(ttl / 2);

  // Reuse the agent
  const reusedAgent = await agentPool.getOrCreateAgent(
    url,
    undefined,
    undefined,
  );
  expect(reusedAgent).toBe(agent);

  // Fast-forward time just past the original TTL
  vi.advanceTimersByTime(ttl / 2 + 100);

  // The agent should still be alive since the TTL was extended
  expect(agent.destroy).not.toHaveBeenCalled();

  // Fast-forward time past the extended TTL
  vi.advanceTimersByTime(ttl / 2);

  // Now the agent should have been destroyed
  expect(agent.destroy).toHaveBeenCalled();
});

test("clear() should reject any pending requests", async () => {
  const agentPool = new AgentPool();
  const url = new URL("https://example.com");

  // Make agent creation take some time
  vi.mocked(getAgentOptions).mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve({}), 100)),
  );

  // Start a request but don't wait for it
  const promise = agentPool.getOrCreateAgent(url, undefined, undefined);

  // Clear the pool before the agent is created
  agentPool.clear();

  // Advance timer to resolve the delayed promise
  vi.advanceTimersByTime(200);

  // The promise should be rejected
  await expect(promise).rejects.toThrow("Agent pool cleared");
});

test("getOrCreateAgent should fall back to creating a new agent if promise rejected", async () => {
  // Reset mocks for this test
  vi.mocked(getAgentOptions).mockResolvedValue({});

  const agentPool = new AgentPool();
  const url = new URL("https://example.com");

  // Create a spy that will throw immediately during cache key generation
  vi.spyOn(agentPool as any, "getCacheKey").mockImplementation(() => {
    throw new Error("Unexpected error");
  });

  // Make sure createAgent works normally
  vi.spyOn(agentPool as any, "createAgent").mockResolvedValue({
    destroy: vi.fn(),
  });

  // This should succeed by creating a fallback agent
  const agent = await agentPool.getOrCreateAgent(url, undefined, undefined);

  // Verify we have an agent
  expect(agent).toBeDefined();
  expect(agent.destroy).toBeDefined();

  // The createAgent method should have been called
  expect((agentPool as any).createAgent).toHaveBeenCalledWith(
    url.protocol,
    undefined,
    undefined,
  );
}, 1000); // Add a reasonable timeout just in case
