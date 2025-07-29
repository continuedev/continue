import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:os", () => ({
  platform: vi.fn(),
  arch: vi.fn(),
}));

vi.mock("vscode", () => ({
  extensions: {
    getExtension: vi.fn(),
  },
}));

describe("isUnsupportedPlatform", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should be true when os is winarm64", async () => {
    const { platform, arch } = await import("node:os");
    vi.mocked(platform).mockReturnValue("win32");
    vi.mocked(arch).mockReturnValue("arm64");

    const { isUnsupportedPlatform } = await import("./util");

    const platformCheck = isUnsupportedPlatform();

    expect(platformCheck.isUnsupported).toBe(true);
    expect(platformCheck.reason).toMatch(/windows/gi);
    expect(platformCheck.reason).toMatch(/arm64/gi);
  });

  it("should not be true when os is supported", async () => {
    const { platform, arch } = await import("node:os");
    vi.mocked(platform).mockReturnValue("linux");
    vi.mocked(arch).mockReturnValue("arm64");

    const { isUnsupportedPlatform } = await import("./util");

    const platformCheck = isUnsupportedPlatform();

    expect(platformCheck.isUnsupported).toBe(false);
  });
});

describe("isExtensionPrerelease", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("detects prerelease versions correctly", async () => {
    const vscode = await import("vscode");
    const getExtensionMock = vi.mocked(vscode.extensions.getExtension);

    // 1.0.0 is not prerelease (even minor version)
    getExtensionMock.mockReturnValue({
      packageJSON: { version: "1.0.0" },
    } as any);

    const { isExtensionPrerelease } = await import("./util");

    expect(isExtensionPrerelease()).toBe(false);

    // 1.1.0 is prerelease (odd minor version)
    getExtensionMock.mockReturnValue({
      packageJSON: { version: "1.1.0" },
    } as any);

    expect(isExtensionPrerelease()).toBe(true);
  });
});
