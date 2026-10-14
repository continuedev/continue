import { afterEach, describe, expect, it, vi } from "vitest";

// ---------- Module mocks ----------

// Simple Handlebars mock that does naive placeholder substitution
vi.mock("handlebars", () => {
  return {
    default: {
      compile: (template: string) => (ctx: Record<string, string>) => {
        return template
          .replace(/{{prefix}}/g, ctx.prefix)
          .replace(/{{suffix}}/g, ctx.suffix)
          .replace(/{{filename}}/g, ctx.filename ?? "")
          .replace(/{{reponame}}/g, ctx.reponame ?? "")
          .replace(/{{language}}/g, ctx.language ?? "");
      },
    },
  };
});

// Token utilities – we map 1 char = 1 token for simplicity
vi.mock("../../../llm/countTokens", () => {
  const countTokens = (str: string) => str.length;
  const pruneLinesFromTop = (str: string, allowed: number) =>
    str.slice(Math.max(0, str.length - allowed));
  const pruneLinesFromBottom = (str: string, allowed: number) =>
    str.slice(0, allowed);
  const getTokenCountingBufferSafety = () => 0;

  return {
    countTokens,
    pruneLinesFromTop,
    pruneLinesFromBottom,
    getTokenCountingBufferSafety,
  };
});

// Snippet selection – configurable via constant return value
vi.mock("../filtering", () => ({
  getSnippets: () => [],
}));

// Snippet formatting
const FORMATTED_SNIPPETS = "[FORMATTED_SNIPPETS]";
vi.mock("../formatting", () => ({
  formatSnippets: () => FORMATTED_SNIPPETS,
}));

// Stop tokens helper – we expose a variable so each test can override it
let stopTokenReturn: string[] = ["<STOP>"];
vi.mock("../getStopTokens", () => ({
  getStopTokens: () => stopTokenReturn,
}));

// AutocompleteTemplate – provide overridable template + compiler + completionOptions
let templateOverride: any = "{{prefix}}|{{suffix}}";
let compileFnOverride: ((...args: any[]) => [string, string]) | undefined;
let completionOptionsOverride: Record<string, any> | undefined;
vi.mock("../AutocompleteTemplate", () => ({
  getTemplateForModel: () => ({
    template: templateOverride,
    compilePrefixSuffix: compileFnOverride,
    completionOptions: completionOptionsOverride ?? {},
  }),
}));

// ---------- Imports after mocks ----------
import { renderPrompt, renderPromptWithTokenLimit } from "..";
import { AutocompleteLanguageInfo } from "../../constants/AutocompleteLanguageInfo";
import { SnippetPayload } from "../../snippets";
import { HelperVars } from "../../util/HelperVars";

// ---------- Helper builders ----------

const tsLang: AutocompleteLanguageInfo = {
  name: "TypeScript",
  topLevelKeywords: [],
  singleLineComment: "//",
  endOfLine: [";"],
};

const emptySnippetPayload: SnippetPayload = {
  rootPathSnippets: [],
  importDefinitionSnippets: [],
  ideSnippets: [],
  recentlyEditedRangeSnippets: [],
  recentlyVisitedRangesSnippets: [],
  diffSnippets: [],
  clipboardSnippets: [],
  recentlyOpenedFileSnippets: [],
  staticSnippet: [],
};

function makeHelper(overrides: any = {}) {
  return {
    input: {
      filepath: "file:///test.ts",
      pos: { line: 0, character: 0 },
      recentlyEditedRanges: [],
      recentlyVisitedRanges: [],
      ...overrides.input,
    },
    prunedPrefix: "PRUNED_PREFIX",
    prunedSuffix: "PRUNED_SUFFIX",
    lang: tsLang,
    modelName: "test-model",
    filepath: "file:///test.ts",
    workspaceUris: [],
    options: {
      // Default template can be overridden per test
      template: "{{prefix}}|{{suffix}}",
      maxPromptTokens: 2048,
      prefixPercentage: 0.5,
      maxSuffixPercentage: 0.5,
      experimental_includeClipboard: false,
      useRecentlyOpened: false,
      experimental_includeRecentlyVisitedRanges: false,
      experimental_includeRecentlyEditedRanges: false,
      experimental_includeDiff: false,
      onlyMyCode: false,
      ...overrides.options,
    },
    ...overrides,
  } as unknown as HelperVars;
}

afterEach(() => {
  // reset overridable mocks
  templateOverride = "{{prefix}}|{{suffix}}";
  compileFnOverride = undefined;
  completionOptionsOverride = undefined;
  stopTokenReturn = ["<STOP>"];
  vi.restoreAllMocks();
});

// ---------- Test suite ----------

describe("renderPrompt prefix/suffix selection", () => {
  it("uses manuallyPassPrefix when provided", () => {
    const helper = makeHelper({
      input: { manuallyPassPrefix: "MANUAL" },
    });

    const { prefix, suffix } = renderPrompt({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
    });

    expect(suffix).toBe("\n");
    expect(prefix.endsWith("MANUAL")).toBe(true);
  });

  it("falls back to prunedPrefix when no manual prefix", () => {
    const helper = makeHelper({});

    const { prefix } = renderPrompt({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
    });

    expect(prefix.includes("PRUNED_PREFIX")).toBe(true);
  });
});

describe("template rendering paths", () => {
  it("handles function template", () => {
    templateOverride = (
      p: string,
      s: string,
      _filepath: string,
      _reponame: string,
    ) => `FUNC:${p}|${s}`;

    const helper = makeHelper({ options: { template: undefined } });

    const { prompt } = renderPrompt({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
    });

    expect(prompt.startsWith("FUNC:")).toBe(true);
    expect(prompt.includes("PRUNED_PREFIX")).toBe(true);
  });
});

describe("compilePrefixSuffix vs snippet formatting", () => {
  it("applies compilePrefixSuffix when provided", () => {
    compileFnOverride = (p: string, s: string) => [`COMP_${p}`, `COMP_${s}`];
    templateOverride = "{{prefix}}|{{suffix}}";
    const helper = makeHelper({ options: { template: undefined } });

    const { prefix: compiledPrefix } = renderPrompt({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
    });

    expect(compiledPrefix.startsWith("COMP_PRUNED_PREFIX")).toBe(true);
  });

  it("prepends formatted snippets when no compiler present", () => {
    const helper = makeHelper({});

    const { prefix: compiledPrefix } = renderPrompt({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
    });

    expect(compiledPrefix.startsWith(`${FORMATTED_SNIPPETS}\n`)).toBe(true);
  });
});

describe("renderPromptWithTokenLimit parity & pruning", () => {
  it("matches renderPrompt when llm is undefined", () => {
    const helper = makeHelper({});

    const res1 = renderPrompt({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
    });

    const res2 = renderPromptWithTokenLimit({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
      llm: undefined,
    });

    expect(res2).toEqual(res1);
  });

  it("prunes prefix/suffix to respect small context length", () => {
    const longPrefix = "A".repeat(300);

    const helper = makeHelper({ prunedPrefix: longPrefix });

    const llmStub = {
      contextLength: 120,
      completionOptions: { maxTokens: 10 },
      model: "test-model",
    } as any;

    const { prefix: compiledPrefix } = renderPromptWithTokenLimit({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
      llm: llmStub,
    });

    expect(compiledPrefix.length).toBeLessThan(120);
  });

  it("does not prune prompt to empty when contextLength equals DEFAULT_MAX_TOKENS (4096) with default completionOptions", () => {
    const prefix =
      "def hello():\n    print('Hello, world!')\n\nif __name__ == '__main__':\n    ";
    const helper = makeHelper({ prunedPrefix: prefix, fullPrefix: prefix });

    const llmStub = {
      contextLength: 4096,
      completionOptions: {}, // No explicit maxTokens set, falls back to default
      model: "test-model",
    } as any;

    const { prefix: compiledPrefix } = renderPromptWithTokenLimit({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
      llm: llmStub,
    });

    expect(compiledPrefix).not.toBe("");
    expect(compiledPrefix).toContain("def hello()");
  });

  it("handles models with small contextLength (2048) without negative budget", () => {
    const prefix = "function add(a, b) {\n  return a + b;\n}\n";
    const helper = makeHelper({ prunedPrefix: prefix, fullPrefix: prefix });

    const llmStub = {
      contextLength: 2048,
      completionOptions: {},
      model: "test-model",
    } as any;

    const { prefix: compiledPrefix } = renderPromptWithTokenLimit({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
      llm: llmStub,
    });

    expect(compiledPrefix).toContain("function add");
  });

  it("safely caps reservedTokens when llm.completionOptions.maxTokens exceeds context window", () => {
    const prefix = "const x = 42;\nconst y = 84;\n";
    const helper = makeHelper({ prunedPrefix: prefix, fullPrefix: prefix });

    const llmStub = {
      contextLength: 2048,
      completionOptions: { maxTokens: 8192 }, // Misconfigured maxTokens exceeding context
      model: "test-model",
    } as any;

    const { prefix: compiledPrefix } = renderPromptWithTokenLimit({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
      llm: llmStub,
    });

    expect(compiledPrefix).toContain("const x = 42;");
  });

  it("respects explicit small maxTokens option in completionOptions", () => {
    const prefix = "let count = 0;\n";
    const helper = makeHelper({ prunedPrefix: prefix, fullPrefix: prefix });

    const llmStub = {
      contextLength: 4096,
      completionOptions: { maxTokens: 64 },
      model: "test-model",
    } as any;

    const { prefix: compiledPrefix } = renderPromptWithTokenLimit({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
      llm: llmStub,
    });

    expect(compiledPrefix).toContain("let count = 0;");
  });
});

describe("stop-token merging", () => {
  it("returns stop tokens from getStopTokens", () => {
    stopTokenReturn = ["LANG_STOP", "TEMPLATE_STOP"];
    completionOptionsOverride = { stop: ["TEMPLATE_STOP"] };
    templateOverride = "{{prefix}}|{{suffix}}";

    const helper = makeHelper({ options: { template: undefined } });

    const { completionOptions } = renderPrompt({
      snippetPayload: emptySnippetPayload,
      workspaceDirs: ["file:///workspace"],
      helper,
    });

    expect(completionOptions?.stop).toEqual(stopTokenReturn);
  });
});
