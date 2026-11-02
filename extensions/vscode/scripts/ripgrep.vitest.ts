import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ripgrepPackageForTarget } = require("./ripgrep.js");

describe("ripgrepPackageForTarget", () => {
  it.each([
    ["linux-x64", undefined, "@vscode/ripgrep-linux-x64"],
    ["linux-arm64", undefined, "@vscode/ripgrep-linux-arm64"],
    ["darwin-x64", undefined, "@vscode/ripgrep-darwin-x64"],
    ["darwin-arm64", undefined, "@vscode/ripgrep-darwin-arm64"],
    ["win32-x64", undefined, "@vscode/ripgrep-win32-x64"],
    ["win32-arm64", undefined, "@vscode/ripgrep-win32-arm64"],
  ])("maps %s", (target, npmConfigArch, expected) => {
    expect(ripgrepPackageForTarget(target, npmConfigArch)).toBe(expected);
  });

  it("uses the static linux binaries for alpine", () => {
    expect(ripgrepPackageForTarget("alpine-x64")).toBe(
      "@vscode/ripgrep-linux-x64",
    );
    expect(ripgrepPackageForTarget("alpine-arm64")).toBe(
      "@vscode/ripgrep-linux-arm64",
    );
  });

  it("lets npm_config_arch win, because prepackage maps armhf to arm64", () => {
    // CI builds armhf with target "linux-arm64" (after the remap) and npm_config_arch=arm
    expect(ripgrepPackageForTarget("linux-arm64", "arm")).toBe(
      "@vscode/ripgrep-linux-arm",
    );
    expect(ripgrepPackageForTarget("linux-armhf")).toBe(
      "@vscode/ripgrep-linux-arm",
    );
  });

  it("rejects targets with no published binary", () => {
    expect(() => ripgrepPackageForTarget("freebsd-x64")).toThrow(
      /No @vscode\/ripgrep binary/,
    );
    expect(() => ripgrepPackageForTarget("darwin-ia32")).toThrow();
  });
});
