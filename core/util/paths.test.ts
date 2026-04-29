import * as path from "path";
import { getDefaultContinueGlobalDir } from "./paths";

describe("getDefaultContinueGlobalDir", () => {
  const HOME = "/home/user";

  describe("on Linux", () => {
    it("uses ~/.config/continue when no legacy dir exists and XDG_CONFIG_HOME is unset", () => {
      const result = getDefaultContinueGlobalDir({
        platform: "linux",
        homedir: HOME,
        xdgConfigHome: undefined,
        legacyDirExists: false,
      });
      expect(result).toBe(path.join(HOME, ".config", "continue"));
    });

    it("uses $XDG_CONFIG_HOME/continue when XDG_CONFIG_HOME is set and no legacy dir exists", () => {
      const result = getDefaultContinueGlobalDir({
        platform: "linux",
        homedir: HOME,
        xdgConfigHome: "/custom/config",
        legacyDirExists: false,
      });
      expect(result).toBe("/custom/config/continue");
    });

    it("falls back to ~/.continue when the legacy dir already exists", () => {
      const result = getDefaultContinueGlobalDir({
        platform: "linux",
        homedir: HOME,
        xdgConfigHome: "/custom/config",
        legacyDirExists: true,
      });
      expect(result).toBe(path.join(HOME, ".continue"));
    });
  });

  describe("on macOS", () => {
    it("always uses ~/.continue", () => {
      const result = getDefaultContinueGlobalDir({
        platform: "darwin",
        homedir: HOME,
        xdgConfigHome: "/custom/config",
        legacyDirExists: false,
      });
      expect(result).toBe(path.join(HOME, ".continue"));
    });
  });

  describe("on Windows", () => {
    it("always uses ~/.continue", () => {
      const result = getDefaultContinueGlobalDir({
        platform: "win32",
        homedir: "C:\\Users\\user",
        xdgConfigHome: undefined,
        legacyDirExists: false,
      });
      expect(result).toBe(path.join("C:\\Users\\user", ".continue"));
    });
  });
});
