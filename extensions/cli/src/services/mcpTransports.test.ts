import { afterEach, describe, expect, test, vi } from "vitest";

import { constructMcpChildEnv } from "./mcpTransports.js";

describe("constructMcpChildEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("passes through only the common vars plus PATH by default", () => {
    vi.stubEnv("HOME", "/home/test-user");
    vi.stubEnv("USERPROFILE", "C:\\Users\\test-user");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-secret");
    vi.stubEnv("OPENAI_API_KEY", "sk-oai-test-secret");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "aws-test-secret");

    const env = constructMcpChildEnv(undefined);

    expect(env.HOME).toBe("/home/test-user");
    expect(env.USERPROFILE).toBe("C:\\Users\\test-user");
    if (process.env.PATH !== undefined) {
      expect(env.PATH).toBe(process.env.PATH);
    }

    // Secrets from the parent environment must NOT leak into the subprocess
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
  });

  test("server env overrides inherited values", () => {
    vi.stubEnv("HOME", "/home/test-user");

    const env = constructMcpChildEnv({
      HOME: "/custom/home",
      MY_SERVER_TOKEN: "declared-token",
    });

    expect(env.HOME).toBe("/custom/home");
    expect(env.MY_SERVER_TOKEN).toBe("declared-token");
  });

  test("does not mutate the server env object", () => {
    vi.stubEnv("HOME", "/home/test-user");
    const serverEnv: Record<string, string> = {};

    constructMcpChildEnv(serverEnv);

    expect(Object.keys(serverEnv)).toHaveLength(0);
  });

  test("inherits the full parent environment when opted in", () => {
    vi.stubEnv("CONTINUE_CLI_MCP_INHERIT_ALL_ENV", "1");
    vi.stubEnv("MY_CUSTOM_TOOL_VAR", "inherited-value");
    vi.stubEnv("MY_OVERRIDDEN_VAR", "parent-value");

    const env = constructMcpChildEnv({ MY_OVERRIDDEN_VAR: "server-value" });

    // Full inheritance restored (the pre-fix #8602 behavior)...
    expect(env.MY_CUSTOM_TOOL_VAR).toBe("inherited-value");
    // ...with explicit server env still taking precedence
    expect(env.MY_OVERRIDDEN_VAR).toBe("server-value");
  });

  test("opt-in flag disabled by an empty value", () => {
    vi.stubEnv("CONTINUE_CLI_MCP_INHERIT_ALL_ENV", "");
    vi.stubEnv("MY_CUSTOM_TOOL_VAR", "not-inherited");

    const env = constructMcpChildEnv(undefined);

    expect(env.MY_CUSTOM_TOOL_VAR).toBeUndefined();
  });
});
