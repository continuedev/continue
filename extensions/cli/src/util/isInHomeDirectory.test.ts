// eslint-disable-next-line import/order
import { vi } from "vitest";

vi.mock("node:os", () => ({
  default: {
    homedir: vi.fn(),
  },
}));

vi.mock("node:path", () => ({
  default: {
    resolve: vi.fn(),
  },
}));

import os from "node:os";
import path from "node:path";

import { isInHomeDirectory } from "./isInHomeDirectory.js";

describe("isInHomeDirectory", () => {
  const originalCwd = process.cwd;
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    process.cwd = vi.fn();
  });

  afterEach(() => {
    process.cwd = originalCwd;
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
    });
  });

  it("should return true when current directory is home directory on Unix", () => {
    Object.defineProperty(process, "platform", {
      value: "linux",
      writable: true,
    });

    const mockCwd = "/home/user";
    const mockHome = "/home/user";

    vi.mocked(process.cwd).mockReturnValue(mockCwd);
    vi.mocked(os.homedir).mockReturnValue(mockHome);
    vi.mocked(path.resolve).mockImplementation((p: string) => p);

    expect(isInHomeDirectory()).toBe(true);
  });

  it("should return false when current directory is not home directory on Unix", () => {
    Object.defineProperty(process, "platform", {
      value: "linux",
      writable: true,
    });

    const mockCwd = "/home/user/projects";
    const mockHome = "/home/user";

    vi.mocked(process.cwd).mockReturnValue(mockCwd);
    vi.mocked(os.homedir).mockReturnValue(mockHome);
    vi.mocked(path.resolve).mockImplementation((p: string) => p);

    expect(isInHomeDirectory()).toBe(false);
  });

  it("should return true when current directory is home directory on Windows (case insensitive)", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
      writable: true,
    });

    const mockCwd = "C:\\Users\\User";
    const mockHome = "c:\\users\\user";

    vi.mocked(process.cwd).mockReturnValue(mockCwd);
    vi.mocked(os.homedir).mockReturnValue(mockHome);
    vi.mocked(path.resolve).mockImplementation((p: string) => p);

    expect(isInHomeDirectory()).toBe(true);
  });
});
