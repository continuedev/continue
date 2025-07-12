import { expect, test, vi } from "vitest";
import * as vscode from "vscode";

// Mock the vscode module
vi.mock("vscode", () => ({
  extensions: {
    getExtension: vi.fn(),
  },
}));

// Import the function after mocking
import { isExtensionPrerelease } from "./util";

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
