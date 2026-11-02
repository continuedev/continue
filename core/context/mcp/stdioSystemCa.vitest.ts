import { afterEach, beforeEach, describe, expect, test } from "vitest";
import MCPConnection from "./MCPConnection";
import {
  clearSystemCaSupportCache,
  nodeSupportsSystemCa,
  withSystemCaNodeOption,
} from "./stdioSystemCa";

describe("withSystemCaNodeOption", () => {
  test("adds the flag when enabled and supported", () => {
    expect(withSystemCaNodeOption({ A: "1" }, true, true)).toEqual({
      A: "1",
      NODE_OPTIONS: "--use-system-ca",
    });
  });

  test("keeps the user's NODE_OPTIONS and appends", () => {
    expect(
      withSystemCaNodeOption(
        { NODE_OPTIONS: "--max-old-space-size=4096" },
        true,
        true,
      ).NODE_OPTIONS,
    ).toBe("--max-old-space-size=4096 --use-system-ca");
  });

  test("leaves an existing mention of the flag alone", () => {
    const env = { NODE_OPTIONS: "--use-system-ca --trace-warnings" };
    expect(withSystemCaNodeOption(env, true, true)).toBe(env);
  });

  test("does nothing when disabled or when node doesn't support the flag", () => {
    const env = { A: "1" };
    expect(withSystemCaNodeOption(env, false, true)).toBe(env);
    expect(withSystemCaNodeOption(env, true, false)).toBe(env);
  });
});

describe("nodeSupportsSystemCa", () => {
  beforeEach(() => clearSystemCaSupportCache());

  test("is true for the node running these tests (22.15+)", async () => {
    expect(await nodeSupportsSystemCa({ PATH: process.env.PATH })).toBe(true);
  });

  test("is false when no node can be found", async () => {
    expect(await nodeSupportsSystemCa({ PATH: "/nonexistent-dir" })).toBe(
      false,
    );
  });
});

/** Runs a tiny stdio "server" that reports the NODE_OPTIONS it received. */
async function nodeOptionsSeenByServer(requestOptions?: {
  useSystemCa?: boolean;
}) {
  const connection = new MCPConnection(
    {
      id: "stdio",
      name: "stdio",
      type: "stdio",
      command: process.execPath,
      args: [
        "-e",
        "console.error('SEEN[' + (process.env.NODE_OPTIONS ?? '') + ']'); process.exit(1)",
      ],
      requestOptions,
    } as any,
    {
      ide: {
        getIdeInfo: async () => ({}),
        getWorkspaceDirs: async () => [],
      } as any,
    },
  );
  await connection.connectClient(true, new AbortController().signal);
  const text = connection.getStatus().errors.join("\n");
  return text.match(/SEEN\[(.*?)\]/)?.[1];
}

describe("stdio servers get the OS certificate store", () => {
  const saved = process.env.NODE_OPTIONS;
  beforeEach(() => clearSystemCaSupportCache());
  afterEach(() => {
    if (saved === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = saved;
  });

  test("useSystemCa: true passes --use-system-ca to the child", async () => {
    expect(await nodeOptionsSeenByServer({ useSystemCa: true })).toBe(
      "--use-system-ca",
    );
  });

  test("useSystemCa: false does not", async () => {
    expect(await nodeOptionsSeenByServer({ useSystemCa: false })).toBe("");
  });

  test("the platform default applies when nothing is set", async () => {
    const expected =
      process.platform === "win32" || process.platform === "darwin"
        ? "--use-system-ca"
        : "";
    expect(await nodeOptionsSeenByServer()).toBe(expected);
  });
});
