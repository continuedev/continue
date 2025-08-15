import { createTestContext, cleanupTestContext, runCLI } from "../test-helpers/cli-helpers.js";

describe("E2E: Remote Command - Stdin Support", () => {
  let context: any;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await cleanupTestContext(context);
  });

  it("should work correctly when prompt is provided via stdin with remote -s flag", async () => {
    const result = await runCLI(context, {
      args: ["remote", "-s", "--url", "http://example.com"],
      input: "Hello from stdin",
      expectError: false,
      timeout: 5000,
    });

    // Should succeed with direct URL connection
    expect(result.exitCode).toBe(0);
    
    // Should output JSON response for --start mode
    const output = result.stdout;
    expect(output).toContain('"status":"success"');
    expect(output).toContain('"url":"http://example.com"');
    expect(output).toContain('"mode":"direct_url"');
  });

  it("should combine stdin and command line prompt when both are provided", async () => {
    const result = await runCLI(context, {
      args: ["remote", "-s", "--url", "http://example.com", "Command line prompt"],
      input: "Stdin input",
      expectError: false,
      timeout: 5000,
    });

    // Should succeed with direct URL connection
    expect(result.exitCode).toBe(0);
    
    // Should output JSON response for --start mode
    const output = result.stdout;
    expect(output).toContain('"status":"success"');
    expect(output).toContain('"url":"http://example.com"');
    expect(output).toContain('"mode":"direct_url"');
  });

  it("should work with just command line prompt (no stdin)", async () => {
    const result = await runCLI(context, {
      args: ["remote", "-s", "--url", "http://example.com", "Just command line"],
      expectError: false,
      timeout: 5000,
    });

    // Should succeed with direct URL connection
    expect(result.exitCode).toBe(0);
    
    // Should output JSON response for --start mode
    const output = result.stdout;
    expect(output).toContain('"status":"success"');
    expect(output).toContain('"url":"http://example.com"');
    expect(output).toContain('"mode":"direct_url"');
  });

  it("should work with no prompt at all", async () => {
    const result = await runCLI(context, {
      args: ["remote", "-s", "--url", "http://example.com"],
      expectError: false,
      timeout: 5000,
    });

    // Should succeed with direct URL connection
    expect(result.exitCode).toBe(0);
    
    // Should output JSON response for --start mode
    const output = result.stdout;
    expect(output).toContain('"status":"success"');
    expect(output).toContain('"url":"http://example.com"');
    expect(output).toContain('"mode":"direct_url"');
  });
});