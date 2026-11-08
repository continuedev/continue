import * as YAML from "yaml";
import { describe, expect, it } from "vitest";

import { defaultConfig } from "../default";
import {
  checkConfigFile,
  closest,
  configFileCompletions,
  configFileKind,
  ConfigFileContext,
} from "./configFileChecks";

const context: ConfigFileContext = {
  models: [
    { name: "Qwen3.8 Flash", variants: ["plan", "act"] },
    { name: "Claude Sonnet", variants: [] },
  ],
  accounts: ["strata", "bedrock-us", "anthropic-work"],
};

const messages = (kind: Parameters<typeof checkConfigFile>[0], text: string) =>
  checkConfigFile(kind, text, context).map((d) => d.message);

describe("configFileKind", () => {
  it("knows our files by path, in either folder name", () => {
    expect(configFileKind("/home/u/.continuous/config.yaml")).toBe("config");
    expect(configFileKind("file:///w/.continue/configs/work.yaml")).toBe(
      "config",
    );
    expect(configFileKind("C:\\Users\\u\\.continuous\\agents\\a.yaml")).toBe(
      "config",
    );
    expect(configFileKind("/home/u/.continuous/models.yaml")).toBe("models");
    expect(configFileKind("/w/.continuous/providers.yaml")).toBe("providers");
  });

  it("knows the files in a global folder set with CONTINUOUS_GLOBAL_DIR", () => {
    expect(configFileKind("/opt/cfg/models.yaml", "/opt/cfg")).toBe("models");
    expect(configFileKind("C:\\cfg\\config.yaml", "C:\\cfg")).toBe("config");
    expect(
      configFileKind("/opt/other/models.yaml", "/opt/cfg"),
    ).toBeUndefined();
  });

  it("leaves other YAML alone", () => {
    expect(configFileKind("/w/config.yaml")).toBeUndefined();
    expect(configFileKind("/w/.continuous/rules/style.yaml")).toBeUndefined();
    expect(configFileKind("/w/.continuous/permissions.yaml")).toBeUndefined();
    expect(configFileKind("/w/.continuous/config.json")).toBeUndefined();
  });
});

describe("checkConfigFile: no false alarms", () => {
  it("accepts the default config", () => {
    expect(messages("config", YAML.stringify(defaultConfig))).toEqual([]);
  });

  it("accepts a config of catalog models and modes", () => {
    const config = `name: Mine
version: 1.0.0
schema: v1
models:
  - from: Qwen3.8 Flash#act
    roles: [chat, edit, apply]
  - from: Claude Sonnet
  - name: Local
    provider: ollama
    model: llama3
modeModels:
  plan:
    model: Claude Sonnet
  agent:
    model: Qwen3.8 Flash#plan
`;
    expect(messages("config", config)).toEqual([]);
  });

  it("accepts the catalog and accounts from the docs", () => {
    const models = `models:
  - name: Qwen3.8 Flash
    connection: strata
    model: qwen3.8-flash-next-nvfp4-nvfp4
    contextLength: 524288
    capabilities: [tool_use, image_input]
    defaultCompletionOptions: { maxTokens: 8192, temperature: 1.0 }
    variants:
      plan:
        requestOptions:
          extraBodyProperties: { reasoning_effort: xhigh }
  - name: Claude Sonnet
    model: claude-sonnet-4-6
    routes:
      - connection: bedrock-us
        model: us.anthropic.claude-sonnet-4-6
      - connection: anthropic-work
`;
    const providers = `providers:
  - name: anthropic-work
    provider: anthropic
    apiKey: \${{ secrets.CONTINUOUS_ANTHROPIC_WORK_API_KEY }}
  - name: strata
    provider: openai
    apiBase: http://localhost:8083/v1
`;
    expect(messages("models", models)).toEqual([]);
    expect(messages("providers", providers)).toEqual([]);
  });

  it("says nothing about an empty file", () => {
    expect(messages("config", "")).toEqual([]);
    expect(messages("models", "# nothing yet\n")).toEqual([]);
  });
});

describe("checkConfigFile: problems, where they are", () => {
  it("flags a from: the catalog does not have, with a suggestion", () => {
    const text = "name: c\nversion: 1.0.0\nmodels:\n  - from: Claude Sonet\n";
    const [d] = checkConfigFile("config", text, context);
    expect(d.severity).toBe("error");
    expect(d.message).toContain('No model named "Claude Sonet"');
    expect(d.message).toContain('Did you mean "Claude Sonnet"');
    expect(d.range).toEqual({
      start: { line: 3, character: 10 },
      end: { line: 3, character: 22 },
    });
  });

  it("flags an unknown variant and lists the real ones", () => {
    expect(
      messages(
        "config",
        "name: c\nversion: 1.0.0\nmodels:\n  - from: Qwen3.8 Flash#high\n",
      ),
    ).toEqual([
      '"Qwen3.8 Flash" has no variant "high". Its variants: plan, act.',
    ]);
  });

  it("warns about a mode model that exists nowhere", () => {
    const text = `name: c
version: 1.0.0
models:
  - name: Local
    provider: ollama
    model: llama3
modeModels:
  plan:
    model: Local
  agent:
    model: Nope
`;
    const out = checkConfigFile("config", text, context);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("warning");
    expect(out[0].range.start.line).toBe(10);
  });

  it("flags connections with no account, in models and their routes", () => {
    const text = `models:
  - name: A
    connection: strat
    model: a
  - name: B
    model: b
    routes:
      - connection: bedrock-us
      - connection: nowhere
`;
    const out = messages("models", text);
    expect(out).toEqual([
      'No account named "strat" in providers.yaml. Did you mean "strata"?',
      'No account named "nowhere" in providers.yaml.',
    ]);
  });

  it("flags # in a model name and duplicate names", () => {
    const text = `models:
  - name: A#b
    model: a
    provider: openai
  - name: C
    model: c
    provider: openai
  - name: C
    model: c2
    provider: openai
`;
    expect(messages("models", text)).toEqual([
      'A model name cannot contain "#": it picks a variant. This model is skipped.',
      'Another model is named "C" above; the first one is used.',
    ]);
  });

  it("places schema errors on the field", () => {
    const out = checkConfigFile(
      "providers",
      "providers:\n  - name: x\n    apiBase: http://h\n",
      context,
    );
    expect(out).toHaveLength(1);
    expect(out[0].message).toMatch(/^providers\.0\.provider:/);
    expect(out[0].range.start.line).toBe(1);
  });

  it("leaves syntax and schema to the YAML extension when asked, keeping the cross-file checks", () => {
    const text =
      "models:\n  - name: A\n    model: a\n    connection: strat\n    contextLength: lots\n";
    const all = checkConfigFile("models", text, context).map((d) => d.message);
    const crossOnly = checkConfigFile("models", text, context, {
      shapeChecks: false,
    }).map((d) => d.message);
    expect(all.some((m) => m.startsWith("models.0.contextLength"))).toBe(true);
    expect(crossOnly).toEqual([
      'No account named "strat" in providers.yaml. Did you mean "strata"?',
    ]);
    expect(
      checkConfigFile("config", "models: [a,\n", context, {
        shapeChecks: false,
      }),
    ).toEqual([]);
  });

  it("reports YAML syntax errors at their position, and nothing else", () => {
    const out = checkConfigFile("config", "name: c\nmodels: [a,\n", context);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((d) => d.message.startsWith("YAML:"))).toBe(true);
  });
});

describe("configFileCompletions", () => {
  it("offers catalog models and variants after from:", () => {
    const labels = configFileCompletions(
      "config",
      "  - from: Qw",
      context,
    )?.map((c) => c.label);
    expect(labels).toEqual([
      "Qwen3.8 Flash",
      "Qwen3.8 Flash#plan",
      "Qwen3.8 Flash#act",
      "Claude Sonnet",
    ]);
  });

  it("offers accounts after connection:, and nothing elsewhere", () => {
    expect(
      configFileCompletions("models", "    connection: ", context)?.map(
        (c) => c.label,
      ),
    ).toEqual(["strata", "bedrock-us", "anthropic-work"]);
    expect(configFileCompletions("config", "name: ", context)).toBeUndefined();
    expect(
      configFileCompletions("providers", "  connection: ", context),
    ).toBeUndefined();
  });

  it("closest finds near misses only", () => {
    expect(closest("strat", ["strata", "bedrock-us"])).toEqual(["strata"]);
    expect(closest("zzz", ["strata"])).toEqual([]);
  });
});
