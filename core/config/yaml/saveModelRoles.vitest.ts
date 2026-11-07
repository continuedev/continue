import { describe, expect, it } from "vitest";

import { applyModelRoles, listCatalog } from "./saveModelRoles";

describe("listCatalog", () => {
  it("lists each model and each variant, with its account's provider", () => {
    expect(
      listCatalog(
        [
          {
            name: "Qwen",
            connection: "strata",
            model: "qwen",
            variants: { plan: {}, act: {} },
          },
          { name: "Sonnet", provider: "anthropic", model: "claude-sonnet-4-6" },
        ],
        [{ name: "strata", provider: "openai" }],
      ),
    ).toEqual([
      {
        ref: "Qwen",
        name: "Qwen",
        model: "qwen",
        account: "strata",
        provider: "openai",
      },
      {
        ref: "Qwen#plan",
        variant: "plan",
        name: "Qwen",
        model: "qwen",
        account: "strata",
        provider: "openai",
      },
      {
        ref: "Qwen#act",
        variant: "act",
        name: "Qwen",
        model: "qwen",
        account: "strata",
        provider: "openai",
      },
      {
        ref: "Sonnet",
        name: "Sonnet",
        model: "claude-sonnet-4-6",
        provider: "anthropic",
      },
    ]);
  });
});

describe("applyModelRoles", () => {
  const config = {
    models: [
      { from: "Qwen#act", roles: ["chat", "edit"] },
      {
        name: "Embedder",
        provider: "ollama",
        model: "nomic",
        roles: ["embed", "chat"],
      },
      { name: "Defaults", provider: "openai", model: "x" },
    ],
  } as any;

  it("adds a catalog reference that is not in the config yet, with its roles", () => {
    const out = applyModelRoles(config, [
      { ref: "Sonnet", roles: ["chat", "subagent"] },
    ]);
    expect(out.models?.at(-1)).toEqual({
      from: "Sonnet",
      roles: ["chat", "subagent"],
    });
  });

  it("sets the roles of a model already there and keeps roles the table does not edit", () => {
    const out = applyModelRoles(config, [
      { ref: "Embedder", roles: ["autocomplete"] },
      { ref: "Qwen#act", roles: ["chat", "apply"] },
    ]);
    expect(out.models?.[1]).toMatchObject({ roles: ["embed", "autocomplete"] });
    expect(out.models?.[0]).toEqual({
      from: "Qwen#act",
      roles: ["chat", "apply"],
    });
  });

  it("starts from the default roles for a model that has none", () => {
    const out = applyModelRoles(config, [{ ref: "Defaults", roles: ["chat"] }]);
    expect(out.models?.[2]).toMatchObject({ roles: ["chat"] });
  });

  it("removes a from: entry left with no roles, and keeps an inline model with none", () => {
    const out = applyModelRoles(config, [
      { ref: "Qwen#act", roles: [] },
      { ref: "Defaults", roles: [] },
    ]);
    expect(out.models?.map((m: any) => m.from ?? m.name)).toEqual([
      "Embedder",
      "Defaults",
    ]);
    expect(out.models?.[1]).toMatchObject({ roles: [] });
  });

  it("does nothing for a reference with no roles that is not in the config", () => {
    const out = applyModelRoles(config, [{ ref: "Nothing", roles: [] }]);
    expect(out.models).toHaveLength(3);
  });
});
