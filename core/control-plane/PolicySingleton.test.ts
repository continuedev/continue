import { Policy } from "@continuedev/config-yaml";
import { jest } from "@jest/globals";
import { ControlPlaneClient } from "./client.js";
import { PolicySingleton } from "./PolicySingleton.js";

// Mock the ControlPlaneClient
const mockGetPolicy = jest.fn<() => Promise<Policy | null>>();
const mockClient = {
  getPolicy: mockGetPolicy,
} as unknown as ControlPlaneClient;

// Sample policy for testing
const samplePolicy: Policy = {
  allowAnonymousTelemetry: true,
  allowLocalConfigFile: true,
  allowOtherOrganizations: false,
};

test("PolicySingleton returns the same instance", () => {
  const instance1 = PolicySingleton.getInstance(mockClient);
  const instance2 = PolicySingleton.getInstance(mockClient);

  expect(instance1).toBe(instance2);
});

test("getPolicy fetches policy on first call", async () => {
  // Setup
  mockGetPolicy.mockResolvedValueOnce(samplePolicy);
  const policySingleton = PolicySingleton.getInstance(mockClient);

  // Clear any cached data from previous tests
  policySingleton.clearCache();

  // Test
  const policy = await policySingleton.getPolicy("test-org");

  // Verify
  expect(mockGetPolicy).toHaveBeenCalledWith("test-org");
  expect(policy).toEqual(samplePolicy);
});

test("getPolicy uses cached policy on subsequent calls", async () => {
  // Setup
  mockGetPolicy.mockResolvedValueOnce(samplePolicy);
  const policySingleton = PolicySingleton.getInstance(mockClient);

  // Clear any cached data from previous tests
  policySingleton.clearCache();

  // First call should fetch the policy
  await policySingleton.getPolicy("test-org");

  // Reset the mock to verify it's not called again
  mockGetPolicy.mockClear();

  // Second call should use the cached policy
  const policy = await policySingleton.getPolicy("test-org");

  // Verify
  expect(mockGetPolicy).not.toHaveBeenCalled();
  expect(policy).toEqual(samplePolicy);
});

test("getPolicy refetches policy with forceReload=true", async () => {
  // Setup
  mockGetPolicy.mockResolvedValueOnce(samplePolicy);
  const updatedPolicy: Policy = {
    ...samplePolicy,
    allowLocalConfigFile: false,
  };

  mockGetPolicy.mockResolvedValueOnce(updatedPolicy);

  const policySingleton = PolicySingleton.getInstance(mockClient);

  // Clear any cached data from previous tests
  policySingleton.clearCache();

  // First call to cache the initial policy
  await policySingleton.getPolicy("test-org");

  // Force reload should fetch the policy again
  const policy = await policySingleton.getPolicy("test-org", true);

  // Verify
  expect(mockGetPolicy).toHaveBeenCalledTimes(2);
  expect(policy).toEqual(updatedPolicy);
});

test("getPolicy refetches policy for different org slug", async () => {
  // Setup
  const policy1: Policy = {
    ...samplePolicy,
    allowAnonymousTelemetry: true,
  };

  const policy2: Policy = {
    ...samplePolicy,
    allowAnonymousTelemetry: false,
  };

  mockGetPolicy.mockResolvedValueOnce(policy1);
  mockGetPolicy.mockResolvedValueOnce(policy2);

  const policySingleton = PolicySingleton.getInstance(mockClient);

  // Clear any cached data from previous tests
  policySingleton.clearCache();

  // First call for org1
  const result1 = await policySingleton.getPolicy("org1");

  // Second call for org2 should fetch new policy
  const result2 = await policySingleton.getPolicy("org2");

  // Verify
  expect(mockGetPolicy).toHaveBeenCalledWith("org1");
  expect(mockGetPolicy).toHaveBeenCalledWith("org2");
  expect(result1).toEqual(policy1);
  expect(result2).toEqual(policy2);
});

test("clearCache forces a refetch on next getPolicy call", async () => {
  // Setup
  mockGetPolicy.mockResolvedValueOnce(samplePolicy);
  const policySingleton = PolicySingleton.getInstance(mockClient);

  // First call to cache the policy
  await policySingleton.getPolicy("test-org");

  // Clear the mock to verify the next call
  mockGetPolicy.mockClear();
  mockGetPolicy.mockResolvedValueOnce(samplePolicy);

  // Clear the cache
  policySingleton.clearCache();

  // This should trigger a refetch
  await policySingleton.getPolicy("test-org");

  // Verify
  expect(mockGetPolicy).toHaveBeenCalledWith("test-org");
});
