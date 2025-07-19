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
        await $(["unknown-command"]);
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.exitCode).not.toBe(0);
        // Check if error message exists in any of the possible locations
        const errorOutput = error.message || error.stderr || error.stdout || "";
        expect(errorOutput.length).toBeGreaterThan(0);
      }
    });

    it("should show help on invalid flag", async () => {
      try {
        await $(["--invalid-flag"]);
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.exitCode).not.toBe(0);
        // Commander.js usually shows help or error message for invalid flags
        const errorOutput = error.message || error.stderr || error.stdout || "";
        expect(errorOutput.length).toBeGreaterThan(0);
      }
    });
  });
});
