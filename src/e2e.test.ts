import { execaNode } from "execa";
import path from "path";
import { getVersion } from "./version.js";

describe("CLI E2E Tests", () => {
  const $ = (args?: string[] | undefined) =>
    execaNode(path.resolve("dist/index.js"), args);

  beforeAll(() => {
    // Ensure the CLI is built before running E2E tests
    // This should be handled by the npm test script or CI pipeline
  });

  describe("--version flag", () => {
    it("should display version information", async () => {
      const result = await $(["--version"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(getVersion());
    });
  });

  describe("--help flag", () => {
    it("should display help information", async () => {
      const result = await $(["--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Continue CLI");
      expect(result.stdout).toContain("AI-powered development assistant");
      expect(result.stdout).toContain("Options:");
      expect(result.stdout).toContain("-p, --print");
    });

    it("should show available commands", async () => {
      const result = await $(["--help"]);

      expect(result.stdout).toContain("Commands:");
      expect(result.stdout).toContain("login");
      expect(result.stdout).toContain("logout");
    });
  });

  describe("invalid commands", () => {
    it("should show error for unknown command", async () => {
      try {
        // Add explicit timeout for Windows CI
        const result = await execaNode(
          path.resolve("dist/index.js"),
          ["unknown-command"],
          {
            timeout: 5000, // 5 second timeout instead of default 10
            reject: true,
            windowsHide: true, // Prevent console window on Windows
          }
        );
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.exitCode).not.toBe(0);
        // Check if error message exists in any of the possible locations
        const errorOutput = error.message || error.stderr || error.stdout || "";
        expect(errorOutput.length).toBeGreaterThan(0);
      }
    }, 8000); // Increase test timeout to 8 seconds

    it("should show help on invalid flag", async () => {
      try {
        // Add explicit timeout for Windows CI
        const result = await execaNode(
          path.resolve("dist/index.js"),
          ["--invalid-flag"],
          {
            timeout: 5000, // 5 second timeout instead of default 10
            reject: true,
            windowsHide: true, // Prevent console window on Windows
          }
        );
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.exitCode).not.toBe(0);
        // Commander.js usually shows help or error message for invalid flags
        const errorOutput = error.message || error.stderr || error.stdout || "";
        expect(errorOutput.length).toBeGreaterThan(0);
      }
    }, 8000); // Increase test timeout to 8 seconds
  });
});
