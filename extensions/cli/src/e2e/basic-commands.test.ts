import {
  cleanupTestContext,
  createTestContext,
  runCLI,
} from "../test-helpers/cli-helpers.js";
import { getVersion } from "../version.js";

describe("E2E: Basic Commands", () => {
  let context: any;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context);
  });

  describe("--version flag", () => {
    it("should display version information", async () => {
      const result = await runCLI(context, { args: ["--version"] });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(getVersion());
      expect(result.stderr).toBe("");
    });
  });

  describe("--help flag", () => {
    it("should display help information", async () => {
      const result = await runCLI(context, { args: ["--help"] });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Continue CLI");
      expect(result.stdout).toContain("AI-powered development assistant");
      expect(result.stdout).toContain("Options:");
      expect(result.stdout).toContain("-p, --print");
      expect(result.stdout).toContain("--config <path>");
      expect(result.stdout).toContain("--resume");
      expect(result.stdout).toContain("--readonly");
      expect(result.stdout).toContain("--auto");
      expect(result.stdout).toContain("--rule <rule>");
      expect(result.stdout).toContain("--prompt <prompt>");
    });

    it("should show available commands", async () => {
      const result = await runCLI(context, { args: ["--help"] });

      expect(result.stdout).toContain("Commands:");
      expect(result.stdout).toContain("login");
      expect(result.stdout).toContain("logout");
    });
  });

  describe("subcommand help", () => {
    it("should show help for login command", async () => {
      const result = await runCLI(context, { args: ["login", "--help"] });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Authenticate with Continue");
    });

    it("should show help for logout command", async () => {
      const result = await runCLI(context, { args: ["logout", "--help"] });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Log out from Continue");
    });
  });

  describe("invalid commands", () => {
    it("should show error for invalid flag", async () => {
      const result = await runCLI(context, {
        args: ["--invalid-flag"],
        expectError: true,
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr || result.stdout).toContain("error");
    });
  });
});
