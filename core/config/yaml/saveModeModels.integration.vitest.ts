import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as YAML from "yaml";

const SOURCE = `# my config
name: Local
version: 1.0.0
schema: v1

models:
  # primary
  - name: Opus
    provider: anthropic
    model: claude-opus
    apiKey: \${{ secrets.ANTHROPIC_API_KEY }}
  - name: Sonnet
    provider: anthropic
    model: claude-sonnet
  - name: Haiku
    provider: anthropic
    model: claude-haiku
`;

describe("saveModeModels -> config.yaml -> resolveModeModels", () => {
  let dir: string;
  let cfgPath: string;
  let saveModeModels: typeof import("./saveModeModels").saveModeModels;
  let resolveModeModels: typeof import("./modeModels").resolveModeModels;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "mode-models-"));
    process.env.CONTINUE_GLOBAL_DIR = dir;
    cfgPath = path.join(dir, "config.yaml");
    fs.writeFileSync(cfgPath, SOURCE);
    vi.resetModules();
    ({ saveModeModels } = await import("./saveModeModels"));
    ({ resolveModeModels } = await import("./modeModels"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const chat = [{ title: "Opus" }, { title: "Sonnet" }, { title: "Haiku" }];
  const read = () => YAML.parse(fs.readFileSync(cfgPath, "utf8"));

  it("what is saved resolves to the same default and list", () => {
    expect(
      saveModeModels({
        plan: {
          model: "Sonnet",
          models: ["Sonnet", "Opus"],
          reasoningEffort: "high",
        },
      }),
    ).toBe(true);
    const { modeModels, errors } = resolveModeModels(read().modeModels, chat);
    expect(errors).toEqual([]);
    expect(modeModels?.plan).toEqual({
      title: "Sonnet",
      titles: ["Sonnet", "Opus"],
      reasoningEffort: "high",
    });
  });

  it("keeps the file's comments and secret reference", () => {
    saveModeModels({ agent: { model: "Haiku" } });
    const text = fs.readFileSync(cfgPath, "utf8");
    expect(text).toContain("# my config");
    expect(text).toContain("# primary");
    expect(text).toContain("${{ secrets.ANTHROPIC_API_KEY }}");
  });

  it("a second save changes only what it mentions", () => {
    saveModeModels({ plan: { model: "Opus", models: ["Opus", "Haiku"] } });
    saveModeModels({ agent: { model: "Sonnet" } });
    expect(read().modeModels).toEqual({
      plan: { model: "Opus", models: ["Opus", "Haiku"] },
      agent: { model: "Sonnet" },
    });
  });

  it("removing a mode and then everything leaves a valid file", () => {
    saveModeModels({ plan: { model: "Opus" }, agent: { model: "Sonnet" } });
    saveModeModels({ plan: null });
    expect(read().modeModels).toEqual({ agent: { model: "Sonnet" } });
    saveModeModels({ agent: null });
    expect(read()).not.toHaveProperty("modeModels");
    expect(read().models).toHaveLength(3);
  });

  it("a name that is not a model is saved, then reported on load without failing", () => {
    saveModeModels({ plan: { models: ["Opus", "Gone"] } });
    const { modeModels, errors } = resolveModeModels(read().modeModels, chat);
    expect(modeModels?.plan?.titles).toEqual(["Opus"]);
    expect(errors).toHaveLength(1);
    expect(errors[0].fatal).toBe(false);
  });

  it("returns false and writes nothing without a config.yaml", () => {
    fs.rmSync(cfgPath);
    fs.writeFileSync(path.join(dir, "config.json"), "{}");
    expect(saveModeModels({ plan: { model: "Opus" } })).toBe(false);
    expect(fs.existsSync(cfgPath)).toBe(false);
  });

  it("returns true even when the update changes nothing", () => {
    expect(saveModeModels({})).toBe(true);
    expect(fs.readFileSync(cfgPath, "utf8")).toBe(SOURCE);
  });
});
