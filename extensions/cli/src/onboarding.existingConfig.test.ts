import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { AuthConfig } from "./auth/workos.js";

// `env.continueHome` must be a getter so we can swap the underlying tmp
// dir per-test. Vitest hoists vi.mock above imports.
let homeDir: string;

vi.mock("./env.js", () => ({
  env: {
    apiBase: "https://api.continue.dev/",
    workOsClientId: "test-client",
    appUrl: "https://continue.dev",
    get continueHome() {
      return homeDir;
    },
  },
}));

// `loadConfiguration` is exercised heavily elsewhere — stub it here so these
// tests focus on the onboarding gate, not the config loader.
const loadConfigurationMock = vi.fn();
vi.mock("./configLoader.js", () => ({
  loadConfiguration: loadConfigurationMock,
}));

// `getApiClient` reaches out to the network in real life; stub.
vi.mock("./config.js", () => ({
  getApiClient: vi.fn(() => ({})),
}));

let initializeWithOnboarding: typeof import("./onboarding.js").initializeWithOnboarding;
let onboardingCompleteFlag: string;

const mockAuthConfig: AuthConfig = {
  userId: "test-user",
  userEmail: "test@example.com",
  accessToken: "test-token",
  refreshToken: "test-refresh",
  expiresAt: Date.now() + 3_600_000,
  organizationId: "test-org",
};

beforeEach(async () => {
  homeDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "cn-onboarding-")),
  );
  onboardingCompleteFlag = path.join(homeDir, ".onboarding_complete");

  loadConfigurationMock.mockReset();

  // Reset modules so the env mock's getter is consulted fresh per test.
  vi.resetModules();
  ({ initializeWithOnboarding } = await import("./onboarding.js"));
});

afterEach(() => {
  fs.rmSync(homeDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

test("skips onboarding when ~/.continue/config.yaml already exists", async () => {
  // First-time user (no .onboarding_complete) but has a config.yaml in place.
  fs.writeFileSync(
    path.join(homeDir, "config.yaml"),
    `name: Local
version: 1.0.0
schema: v1
models:
  - name: Local
    provider: anthropic
    model: claude-3-5-sonnet-20241022
    apiKey: dummy
`,
  );
  expect(fs.existsSync(onboardingCompleteFlag)).toBe(false);

  await initializeWithOnboarding(null, undefined);

  expect(fs.existsSync(onboardingCompleteFlag)).toBe(true);
  // No --config was provided, so loadConfiguration must not have been called
  // either — the new branch skips both onboarding *and* validation.
  expect(loadConfigurationMock).not.toHaveBeenCalled();
});

test("does not mark onboarding complete when no config.yaml exists", async () => {
  // First-time, no config. The non-TTY test environment causes
  // runOnboardingFlow to short-circuit and return false, so the flag must
  // remain unset — proving our fix's check did *not* fire.
  expect(fs.existsSync(path.join(homeDir, "config.yaml"))).toBe(false);

  await initializeWithOnboarding(null, undefined);

  expect(fs.existsSync(onboardingCompleteFlag)).toBe(false);
});

test("marks onboarding complete after a successful --config load", async () => {
  // No default config.yaml present; user passes --config explicitly.
  loadConfigurationMock.mockResolvedValue({
    config: {},
    source: { type: "cli-flag" },
  });
  expect(fs.existsSync(onboardingCompleteFlag)).toBe(false);

  await initializeWithOnboarding(mockAuthConfig, "/some/explicit/path.yaml");

  expect(loadConfigurationMock).toHaveBeenCalledOnce();
  expect(fs.existsSync(onboardingCompleteFlag)).toBe(true);
});

test("does not mark onboarding complete when --config load fails", async () => {
  loadConfigurationMock.mockRejectedValue(new Error("boom"));

  await expect(
    initializeWithOnboarding(mockAuthConfig, "/bad/path.yaml"),
  ).rejects.toThrow(/Failed to load config from "/);

  expect(fs.existsSync(onboardingCompleteFlag)).toBe(false);
});

test("does not re-mark when onboarding was already complete", async () => {
  fs.writeFileSync(onboardingCompleteFlag, new Date().toISOString());
  const beforeMtime = fs.statSync(onboardingCompleteFlag).mtimeMs;

  await new Promise((r) => setTimeout(r, 5));
  await initializeWithOnboarding(null, undefined);

  expect(fs.statSync(onboardingCompleteFlag).mtimeMs).toBe(beforeMtime);
});
