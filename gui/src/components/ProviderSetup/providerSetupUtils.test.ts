import { describe, expect, it } from "vitest";
import type { ModelPackage } from "../../pages/AddNewModel/configs/models";
import { providers } from "../../pages/AddNewModel/configs/providers";
import {
  buildChecklistRows,
  buildSaveRequest,
  connectionFromModel,
  describeKeyPlan,
  diffSelection,
  filterRows,
  findConnection,
  initialChecked,
  keyProblem,
  keyStorageOptions,
} from "./providerSetupUtils";

const pkg = (model: string, title = model, extra = {}): ModelPackage => ({
  title,
  description: `${title} desc`,
  params: { model },
  isOpenSource: false,
  ...extra,
});

const lists = {
  top: [
    pkg("a", "Alpha"),
    pkg("b", "Beta"),
    pkg("c", "Gamma"),
    pkg("d", "Delta"),
  ],
  other: [pkg("e", "Epsilon"), pkg("old", "Old", { deprecated: true })],
};

describe("buildChecklistRows / initialChecked", () => {
  it("marks configured models and appends ones the provider does not offer", () => {
    const groups = buildChecklistRows(lists, [
      { name: "My Beta", model: "b" },
      { name: "Custom", model: "custom-id" },
    ]);
    expect(groups.top.find((r) => r.model === "b")?.configured).toBe(true);
    expect(groups.top.find((r) => r.model === "a")?.configured).toBe(false);
    expect(groups.configuredOnly).toEqual([
      expect.objectContaining({ model: "custom-id", title: "Custom" }),
    ]);
  });

  it("starts with the first three popular models for a new provider", () => {
    const groups = buildChecklistRows(lists, []);
    expect([...initialChecked(groups, [])]).toEqual(["a", "b", "c"]);
  });

  it("starts with exactly the configured models when there are some", () => {
    const configured = [{ name: "X", model: "e" }];
    const groups = buildChecklistRows(lists, configured);
    expect([...initialChecked(groups, configured)]).toEqual(["e"]);
  });

  it("does not pre-check deprecated models", () => {
    const groups = buildChecklistRows(
      { top: [pkg("old", "Old", { deprecated: true }), pkg("a")] },
      [],
    );
    expect([...initialChecked(groups, [])]).toEqual(["a"]);
  });
});

describe("filterRows", () => {
  const rows = buildChecklistRows(lists, []).top;
  it("keeps order with no query", () => {
    expect(filterRows(rows, "  ")).toBe(rows);
  });
  it("finds by title and by model id", () => {
    expect(filterRows(rows, "gam").map((r) => r.model)).toEqual(["c"]);
    expect(filterRows(rows, "zzz")).toEqual([]);
  });
});

describe("diffSelection", () => {
  const configured = [
    { name: "Alpha", model: "a" },
    { name: "Custom", model: "custom-id" },
  ];
  const groups = buildChecklistRows(lists, configured);

  it("adds newly checked, removes unchecked, keeps the rest", () => {
    const diff = diffSelection(groups, configured, new Set(["a", "b"]));
    expect(diff.add.map((r) => r.model)).toEqual(["b"]);
    expect(diff.remove.map((m) => m.name)).toEqual(["Custom"]);
    expect(diff.keep.map((m) => m.name)).toEqual(["Alpha"]);
  });

  it("is empty when nothing changed", () => {
    const diff = diffSelection(groups, configured, new Set(["a", "custom-id"]));
    expect(diff).toMatchObject({ add: [], remove: [] });
  });
});

describe("key choices", () => {
  it("offers secure storage only when the editor has it", () => {
    expect(keyStorageOptions(true).map((o) => o.value)).toEqual([
      "secure",
      "env",
      "envVar",
      "inline",
    ]);
    expect(keyStorageOptions(false).map((o) => o.value)).not.toContain(
      "secure",
    );
  });

  it("validates the name as an environment variable", () => {
    const base = { storage: "env" as const, value: "k" };
    expect(
      keyProblem({ ...base, secretName: "GOOD_1" }, { keyRequired: true }),
    ).toBeUndefined();
    for (const bad of ["", "1A", "A B", "A-B", "A=B"]) {
      expect(
        keyProblem({ ...base, secretName: bad }, { keyRequired: true }),
      ).toMatch(/letters, digits/);
    }
  });

  it("requires a value only for a new key or inline storage", () => {
    const c = { storage: "env" as const, secretName: "K", value: "" };
    expect(keyProblem(c, { keyRequired: true })).toBe("Enter the key");
    expect(keyProblem(c, { keyRequired: false })).toBeUndefined();
    expect(
      keyProblem({ ...c, storage: "inline" }, { keyRequired: false }),
    ).toBe("Enter the key");
    expect(
      keyProblem({ ...c, storage: "envVar" }, { keyRequired: true }),
    ).toBeUndefined();
  });

  it("describes where the key goes without echoing it", () => {
    const text = describeKeyPlan(
      { storage: "secure", secretName: "K", value: "sk-hunter2" },
      "Anthropic",
    );
    expect(text).toMatch(/secure storage as K/);
    expect(text).not.toContain("hunter2");
    expect(describeKeyPlan(undefined, "Anthropic")).toMatch(/stays as it is/);
  });
});

describe("connections", () => {
  it("derives the connection from a model and ignores blanks", () => {
    expect(
      connectionFromModel({
        apiBase: " http://x/v1 ",
        region: "",
        profile: "p",
      }),
    ).toEqual({ apiBase: "http://x/v1", profile: "p" });
  });

  it("finds a configured connection ignoring trailing slashes", () => {
    const found = findConnection(
      [
        {
          provider: "openai",
          connection: { apiBase: "http://x/v1" },
          models: [],
          key: { state: "none" },
        },
      ],
      "openai",
      { apiBase: "http://x/v1/" },
    );
    expect(found).toBeTruthy();
    expect(findConnection([], "openai", {})).toBeUndefined();
  });
});

describe("buildSaveRequest", () => {
  const anthropic = providers["anthropic"]!;
  const rows = buildChecklistRows(
    { top: [anthropic.packages[0], anthropic.packages[1]] },
    [],
  ).top;

  it("keeps the key out of the model descriptions", () => {
    const request = buildSaveRequest({
      provider: anthropic,
      values: { apiKey: "sk-ant-hunter2" },
      diff: { add: rows, remove: [], keep: [] },
      key: {
        storage: "secure",
        secretName: "CONTINUED_ANTHROPIC_API_KEY",
        value: "sk-ant-hunter2",
      },
    });
    expect(request.add).toHaveLength(2);
    expect(request.add!.every((m) => m.provider === "anthropic")).toBe(true);
    expect(JSON.stringify(request.add)).not.toContain("hunter2");
    expect(request.key).toEqual({
      storage: "secure",
      secretName: "CONTINUED_ANTHROPIC_API_KEY",
      value: "sk-ant-hunter2",
    });
  });

  it("sends removals by name and no key section when there is none", () => {
    const request = buildSaveRequest({
      provider: anthropic,
      values: {},
      diff: {
        add: [],
        remove: [{ name: "Old one", model: "x" }],
        keep: [],
      },
    });
    expect(request.remove).toEqual(["Old one"]);
    expect(request.key).toBeUndefined();
  });

  it("omits the secret name for inline and the value for an env variable", () => {
    const inline = buildSaveRequest({
      provider: anthropic,
      values: {},
      diff: { add: rows, remove: [], keep: [] },
      key: { storage: "inline", secretName: "IGNORED", value: "k" },
    });
    expect(inline.key).toEqual({ storage: "inline", value: "k" });
    const envVar = buildSaveRequest({
      provider: anthropic,
      values: {},
      diff: { add: rows, remove: [], keep: [] },
      key: { storage: "envVar", secretName: "MY_KEY", value: "ignored" },
    });
    expect(envVar.key).toEqual({ storage: "envVar", secretName: "MY_KEY" });
  });
});
