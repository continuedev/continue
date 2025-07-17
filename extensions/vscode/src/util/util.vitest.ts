import { afterEach, describe, expect, it, vi } from "vitest";

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
