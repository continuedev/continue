import { describe, expect, it } from "vitest";
import * as YAML from "yaml";
import { editYamlText } from "./yamlEdit";

const SAMPLE = `# My config
name: Local Config
version: 1.0.0
schema: v1

models:
  # primary model
  - name: Claude Sonnet
    provider: anthropic
    model: claude-sonnet-4-6
    apiKey: \${{ secrets.ANTHROPIC_API_KEY }} # keep this secret
    roles: [chat]
  - name: GPT
    provider: openai
    model: gpt-5
    roles: [chat, edit]

# per-mode models
modeModels:
  plan:
    model: Claude Sonnet
`;

const edit = (cb: (c: any) => any, src = SAMPLE) => editYamlText<any>(src, cb);

describe("editYamlText", () => {
  it("keeps comments, key order and secret references when adding a model", () => {
    const { text } = edit((c) => ({
      ...c,
      models: [
        ...c.models,
        { name: "Nova", provider: "bedrock", model: "amazon.nova-pro-v1:0" },
      ],
    }));
    expect(text).toBeDefined();
    expect(text).toContain("# My config");
    expect(text).toContain("# primary model");
    expect(text).toContain("# keep this secret");
    expect(text).toContain("# per-mode models");
    expect(text).toContain("${{ secrets.ANTHROPIC_API_KEY }}");
    const parsed = YAML.parse(text!);
    expect(parsed.models.map((m: any) => m.name)).toEqual([
      "Claude Sonnet",
      "GPT",
      "Nova",
    ]);
    expect(Object.keys(parsed)).toEqual([
      "name",
      "version",
      "schema",
      "models",
      "modeModels",
    ]);
  });

  it("keeps inline lists compact instead of padding them", () => {
    const { text } = edit((c) => ({ ...c, name: "Renamed" }));
    expect(text).toContain("roles: [chat]");
    expect(text).not.toContain("[ chat ]");
  });

  it("updates one nested value without touching its neighbours", () => {
    const { text } = edit((c) => {
      c.modeModels.plan.model = "GPT";
      return c;
    });
    const parsed = YAML.parse(text!);
    expect(parsed.modeModels.plan.model).toBe("GPT");
    expect(parsed.models).toHaveLength(2);
    expect(text).toContain("# keep this secret");
  });

  it("removes a model and keeps comments on the others", () => {
    const { text } = edit((c) => ({
      ...c,
      models: c.models.filter((m: any) => m.name !== "GPT"),
    }));
    expect(YAML.parse(text!).models).toHaveLength(1);
    expect(text).toContain("# primary model");
    expect(text).toContain("# keep this secret");
  });

  it("adds a new top-level block", () => {
    const { text } = edit((c) => ({
      ...c,
      toolPermissions: { deny: ["readFile(**/.env)"] },
    }));
    expect(YAML.parse(text!).toolPermissions.deny).toEqual([
      "readFile(**/.env)",
    ]);
  });

  it("returns no text when the callback changes nothing", () => {
    expect(edit((c) => c).text).toBeUndefined();
  });

  it("leaves an invalid file alone and reports why", () => {
    const bad = "models: [unclosed\n  - nope: : :\n";
    const result = edit((c) => c, bad);
    expect(result.text).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it("refuses a document that is not a mapping", () => {
    const result = edit((c) => c, "- just\n- a list\n");
    expect(result.text).toBeUndefined();
    expect(result.error).toMatch(/not a valid object/);
  });

  it("does not mutate the caller's view of the original config", () => {
    let seen: any;
    edit((c) => {
      seen = c;
      c.name = "x";
      return c;
    });
    expect(seen.name).toBe("x");
    expect(YAML.parse(SAMPLE).name).toBe("Local Config");
  });
});
