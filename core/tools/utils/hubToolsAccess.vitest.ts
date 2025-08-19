import { expect, test, vi } from "vitest";
import { ConfigHandler } from "../../config/ConfigHandler";
import { usesFreeTrialApiKey } from "../../config/usesFreeTrialApiKey";
import { checkHubToolsAccess } from "./hubToolsAccess";

// Mock the usesFreeTrialApiKey function
vi.mock("../../config/usesFreeTrialApiKey", () => ({
  usesFreeTrialApiKey: vi.fn(),
}));

test("checkHubToolsAccess should return false when user is not signed in", async () => {
  const mockConfigHandler = {
    controlPlaneClient: {
      isSignedIn: vi.fn().mockResolvedValue(false),
    },
  } as unknown as ConfigHandler;

  const result = await checkHubToolsAccess(mockConfigHandler);

  expect(result).toEqual({
    hasAccess: false,
    isSignedIn: false,
    reason:
      "Sign in to Continue Hub required to access web search and other premium tools.",
  });
});

test("checkHubToolsAccess should return false when user is signed in but using free trial", async () => {
  const mockConfigHandler = {
    controlPlaneClient: {
      isSignedIn: vi.fn().mockResolvedValue(true),
    },
    getSerializedConfig: vi.fn().mockResolvedValue({
      config: { mockConfig: true },
    }),
  } as unknown as ConfigHandler;

  vi.mocked(usesFreeTrialApiKey).mockReturnValue(true);

  const result = await checkHubToolsAccess(mockConfigHandler);

  expect(result).toEqual({
    hasAccess: false,
    isSignedIn: true,
    reason:
      "Upgrade to a paid Continue Hub account to access web search and other premium tools.",
  });
});

test("checkHubToolsAccess should return true when user is signed in and not using free trial", async () => {
  const mockConfigHandler = {
    controlPlaneClient: {
      isSignedIn: vi.fn().mockResolvedValue(true),
    },
    getSerializedConfig: vi.fn().mockResolvedValue({
      config: { mockConfig: true },
    }),
  } as unknown as ConfigHandler;

  vi.mocked(usesFreeTrialApiKey).mockReturnValue(false);

  const result = await checkHubToolsAccess(mockConfigHandler);

  expect(result).toEqual({
    hasAccess: true,
    isSignedIn: true,
  });
});

test("checkHubToolsAccess should return false when config is null", async () => {
  const mockConfigHandler = {
    controlPlaneClient: {
      isSignedIn: vi.fn().mockResolvedValue(true),
    },
    getSerializedConfig: vi.fn().mockResolvedValue({
      config: null,
    }),
  } as unknown as ConfigHandler;

  vi.mocked(usesFreeTrialApiKey).mockReturnValue(false);

  const result = await checkHubToolsAccess(mockConfigHandler);

  expect(result).toEqual({
    hasAccess: true,
    isSignedIn: true,
  });
});
