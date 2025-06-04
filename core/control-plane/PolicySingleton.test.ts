import { jest } from "@jest/globals";
import { ControlPlaneClient, PolicyResponse } from "./client.js";
import { PolicySingleton } from "./PolicySingleton.js";

// Mock the ControlPlaneClient
const mockGetPolicy = jest.fn<() => Promise<PolicyResponse | null>>();
const mockClient = {
  getPolicy: mockGetPolicy,
} as unknown as ControlPlaneClient;

// Sample policy for testing
const samplePolicy: PolicyResponse = {
  orgSlug: "test-org",
  policy: {
    allowAnonymousTelemetry: true,
    allowLocalConfigFile: true,
    allowOtherOrganizations: false,
  },
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
  const policy = await policySingleton.getPolicy();

  // Verify
  expect(mockGetPolicy).toHaveBeenCalled();
  expect(policy).toEqual(samplePolicy);
});

test("getPolicy uses cached policy on subsequent calls", async () => {
  // Setup
  mockGetPolicy.mockResolvedValueOnce(samplePolicy);
  const policySingleton = PolicySingleton.getInstance(mockClient);

  // Clear any cached data from previous tests
  policySingleton.clearCache();

  // First call should fetch the policy
  await policySingleton.getPolicy();

  // Reset the mock to verify it's not called again
  mockGetPolicy.mockClear();

  // Second call should use the cached policy
  const policy = await policySingleton.getPolicy();

  // Verify
  expect(mockGetPolicy).not.toHaveBeenCalled();
  expect(policy).toEqual(samplePolicy);
});

test("getPolicy refetches policy with forceReload=true", async () => {
  // Setup
  mockGetPolicy.mockResolvedValueOnce(samplePolicy);
  const updatedPolicy: PolicyResponse = {
    orgSlug: "test-org",
    policy: {
      allowAnonymousTelemetry: true,
      allowLocalConfigFile: false,
      allowOtherOrganizations: false,
    },
  };

  mockGetPolicy.mockResolvedValueOnce(updatedPolicy);
  const policySingleton = PolicySingleton.getInstance(mockClient);

  // Clear any cached data from previous tests
  policySingleton.clearCache();

  // First call to cache the initial policy
  await policySingleton.getPolicy();

  // Force reload should fetch the policy again
  const policy = await policySingleton.getPolicy(true);

  // Verify
  expect(mockGetPolicy).toHaveBeenCalledTimes(2);
  expect(policy).toEqual(updatedPolicy);
});

test("clearCache forces a refetch on next getPolicy call", async () => {
  // Setup
  mockGetPolicy.mockResolvedValueOnce(samplePolicy);
  const policySingleton = PolicySingleton.getInstance(mockClient);

  // First call to cache the policy
  await policySingleton.getPolicy();

  // Clear the mock to verify the next call
  mockGetPolicy.mockClear();
  mockGetPolicy.mockResolvedValueOnce(samplePolicy);

  // Clear the cache
  policySingleton.clearCache();

  // This should trigger a refetch
  await policySingleton.getPolicy();

  // Verify
  expect(mockGetPolicy).toHaveBeenCalled();
});
