import { configYamlSchema, toolPermissionsSchema } from "./schemas/index.js";
import { Registry } from "./interfaces/index.js";
import { mergeToolPermissions, mergeUnrolledAssistants } from "./load/merge.js";
import { unrollBlocks } from "./load/unroll.js";

const emptyRegistry: Registry = {
  getContent: async () => {
    throw new Error("no blocks expected");
  },
};

describe("toolPermissions schema", () => {
  it("accepts allow, ask and deny lists, each optional", () => {
    const parsed = toolPermissionsSchema.parse({
      allow: ["runTerminalCommand(npm test*)"],
      deny: ["readFile(**/.env)"],
    });
    expect(parsed.allow).toEqual(["runTerminalCommand(npm test*)"]);
    expect(parsed.ask).toBeUndefined();
    expect(toolPermissionsSchema.parse({})).toEqual({});
  });

  it("rejects non-string rules", () => {
    expect(() => toolPermissionsSchema.parse({ allow: [1] })).toThrow();
    expect(() => toolPermissionsSchema.parse({ deny: "readFile" })).toThrow();
  });

  it("is part of config.yaml and optional", () => {
    const cfg = configYamlSchema.parse({
      name: "c",
      version: "1",
      toolPermissions: { deny: ["runTerminalCommand(terraform apply*)"] },
    });
    expect(cfg.toolPermissions?.deny).toHaveLength(1);
    expect(
      configYamlSchema.parse({ name: "c", version: "1" }).toolPermissions,
    ).toBeUndefined();
  });
});

describe("toolPermissions through unrolling and merging", () => {
  it("is preserved when unrolling an assistant", async () => {
    const result = await unrollBlocks(
      {
        name: "c",
        version: "1",
        toolPermissions: { ask: ["runTerminalCommand(git push*)"] },
      },
      emptyRegistry,
      undefined,
    );
    expect(result.config?.toolPermissions).toEqual({
      ask: ["runTerminalCommand(git push*)"],
    });
  });

  it("concatenates rules from both sides instead of replacing them", () => {
    const merged = mergeUnrolledAssistants(
      {
        name: "a",
        version: "1",
        toolPermissions: { deny: ["readFile(**/.env)"] },
      },
      {
        name: "b",
        version: "1",
        toolPermissions: {
          deny: ["runTerminalCommand(rm*)"],
          allow: ["readFile(src/**)"],
        },
      },
    );
    expect(merged.toolPermissions).toEqual({
      deny: ["readFile(**/.env)", "runTerminalCommand(rm*)"],
      allow: ["readFile(src/**)"],
    });
  });

  it("never drops a deny rule when the other side has none", () => {
    expect(
      mergeToolPermissions({ deny: ["readFile(**/.env)"] }, undefined),
    ).toEqual({ deny: ["readFile(**/.env)"] });
    expect(
      mergeToolPermissions(undefined, { deny: ["readFile(**/.env)"] }),
    ).toEqual({ deny: ["readFile(**/.env)"] });
  });

  it("removes duplicate rules and returns undefined when both are empty", () => {
    expect(
      mergeToolPermissions({ allow: ["a", "b"] }, { allow: ["b", "c"] }),
    ).toEqual({ allow: ["a", "b", "c"] });
    expect(mergeToolPermissions(undefined, undefined)).toBeUndefined();
    expect(mergeToolPermissions({}, {})).toBeUndefined();
  });

  it("leaves toolPermissions out when neither assistant sets it", () => {
    const merged = mergeUnrolledAssistants(
      { name: "a", version: "1" },
      { name: "b", version: "1" },
    );
    expect(merged).not.toHaveProperty("toolPermissions");
  });
});
