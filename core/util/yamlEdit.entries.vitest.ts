import { describe, expect, it } from "vitest";
import * as YAML from "yaml";
import { editYamlText } from "./yamlEdit";

const edit = (cb: (c: any) => any, src: string) => editYamlText<any>(src, cb);

const COMMENTED_LIST = `models:
  # first model
  - name: A
    provider: openai
    model: gpt-5
  # second model
  - name: B
    provider: openai
    model: gpt-5-mini
  # third model
  - name: C
    provider: openai
    model: gpt-5-nano
`;

describe("editYamlText: comments follow their entry", () => {
  it("removing the FIRST entry does not move its comment onto the next one", () => {
    const { text } = edit(
      (c) => ({ ...c, models: c.models.filter((m: any) => m.name !== "A") }),
      COMMENTED_LIST,
    );
    expect(text).not.toContain("# first model");
    expect(text).toMatch(/# second model\s+- name: B/);
    expect(text).toMatch(/# third model\s+- name: C/);
  });

  it("removing a middle entry keeps the others' comments", () => {
    const { text } = edit(
      (c) => ({ ...c, models: c.models.filter((m: any) => m.name !== "B") }),
      COMMENTED_LIST,
    );
    expect(text).not.toContain("# second model");
    expect(text).toMatch(/# first model\s+- name: A/);
    expect(text).toMatch(/# third model\s+- name: C/);
  });

  it("inserting at the front does not shift comments", () => {
    const { text } = edit(
      (c) => ({
        ...c,
        models: [{ name: "Z", provider: "x", model: "y" }, ...c.models],
      }),
      COMMENTED_LIST,
    );
    expect(text).toMatch(/# first model\s+- name: A/);
    expect(text).toMatch(/# third model\s+- name: C/);
    expect(YAML.parse(text!).models[0].name).toBe("Z");
  });

  it("reordering moves each comment with its entry", () => {
    const { text } = edit(
      (c) => ({ ...c, models: [...c.models].reverse() }),
      COMMENTED_LIST,
    );
    expect(YAML.parse(text!).models.map((m: any) => m.name)).toEqual([
      "C",
      "B",
      "A",
    ]);
    expect(text).toMatch(/# third model\s+- name: C/);
    expect(text).toMatch(/# first model\s+- name: A/);
  });

  it("editing a field in one entry keeps its comment", () => {
    const { text } = edit((c) => {
      c.models[1].model = "gpt-5-mini-2";
      return c;
    }, COMMENTED_LIST);
    expect(text).toMatch(
      /# second model\s+- name: B\s+provider: openai\s+model: gpt-5-mini-2/,
    );
    expect(text).toMatch(/# first model\s+- name: A/);
  });

  it("renaming an entry keeps the list intact", () => {
    const { text } = edit((c) => {
      c.models[0].name = "A2";
      return c;
    }, COMMENTED_LIST);
    expect(YAML.parse(text!).models.map((m: any) => m.name)).toEqual([
      "A2",
      "B",
      "C",
    ]);
  });

  it("matches unnamed models by provider + model", () => {
    const src = `models:
  # keep me
  - provider: openai
    model: a
  # and me
  - provider: openai
    model: b
`;
    const { text } = edit((c) => ({ ...c, models: c.models.slice(1) }), src);
    expect(text).not.toContain("# keep me");
    expect(text).toMatch(/# and me\s+- provider: openai\s+model: b/);
    expect(YAML.parse(text!).models).toEqual([
      { provider: "openai", model: "b" },
    ]);
  });

  it("keeps a lone comment above a list (it may describe the whole list)", () => {
    const src = `# my models
models:
  # primary
  - name: A
    provider: x
    model: y
  - name: B
    provider: x
    model: z
`;
    const { text } = edit(
      (c) => ({ ...c, models: c.models.filter((m: any) => m.name !== "A") }),
      src,
    );
    expect(text).toContain("# my models");
    expect(text).toContain("# primary");
    expect(YAML.parse(text!).models.map((m: any) => m.name)).toEqual(["B"]);
  });

  it("handles scalar lists (modeModels.plan.models style)", () => {
    const src = `modeModels:
  plan:
    models:
      - Opus # best
      - GPT
`;
    const { text } = edit((c) => {
      c.modeModels.plan.models = ["Opus", "Gemini"];
      return c;
    }, src);
    expect(YAML.parse(text!).modeModels.plan.models).toEqual([
      "Opus",
      "Gemini",
    ]);
    expect(text).toContain("# best");
  });
});
