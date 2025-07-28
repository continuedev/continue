import { afterEach, describe, expect, it, test, vi } from "vitest";
import * as vscode from "vscode";

// Mock the vscode module
vi.mock("vscode", () => ({
  extensions: {
    getExtension: vi.fn(),
  },
}));

// Import the function after mocking
import { isExtensionPrerelease } from "./util";

describe("isUnsupportedPlatform", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should be true when os is winarm64", async () => {
    vi.doMock("os", () => ({
      platform: vi.fn().mockReturnValue("win32"),
      arch: vi.fn().mockReturnValue("arm64"),
    }));

    // "vscode" import should only be mocked during runtime
    vi.doMock("vscode", () => ({}));

    // import after mocks are done
    const { isUnsupportedPlatform } = await import("./util");

    const platformCheck = isUnsupportedPlatform();

    expect(platformCheck.isUnsupported).toBe(true);
    expect(platformCheck.reason).toMatch(/windows/gi);
    expect(platformCheck.reason).toMatch(/arm64/gi);
  });

  it("should be true when os is unsupported", async () => {
    vi.doMock("os", () => ({
      platform: vi.fn().mockReturnValue("bsd"),
      arch: vi.fn().mockReturnValue("x64"),
    }));

    // "vscode" import should only be mocked during runtime
    vi.doMock("vscode", () => ({}));

    // import after mocks are done
    const { isUnsupportedPlatform } = await import("./util");

    const platformCheck = isUnsupportedPlatform();

    expect(platformCheck.isUnsupported).toBe(true);
    expect(platformCheck.reason).toMatch(/unsupported/gi);
  });

  it("should not be true when os is supported", async () => {
    vi.doMock("os", () => ({
      platform: vi.fn().mockReturnValue("linux"),
      arch: vi.fn().mockReturnValue("arm64"),
    }));

    // "vscode" import should only be mocked during runtime
    vi.doMock("vscode", () => ({}));

    // import after mocks are done
    const { isUnsupportedPlatform } = await import("./util");

    const platformCheck = isUnsupportedPlatform();

    expect(platformCheck.isUnsupported).toBe(true);
  });
});

test("isExtensionPrerelease detects prerelease versions correctly", () => {
  // 1.0.0 is not prerelease (even minor version)
  vi.mocked(vscode.extensions.getExtension).mockReturnValue({
    packageJSON: { version: "1.0.0" },
  } as any);
  expect(isExtensionPrerelease()).toBe(false);

  // 1.1.0 is prerelease (odd minor version)
  vi.mocked(vscode.extensions.getExtension).mockReturnValue({
    packageJSON: { version: "1.1.0" },
  } as any);
  expect(isExtensionPrerelease()).toBe(true);
});
