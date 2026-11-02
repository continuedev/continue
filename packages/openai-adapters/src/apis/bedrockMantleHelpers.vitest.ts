import { describe, expect, it } from "vitest";
import {
  alternateMantlePrefix,
  getMantleErrorHint,
  isMantleRegion,
  isWrongRouteError,
  mantleBaseUrl,
  mantleModelOptions,
  maxTokensParamFromError,
  normalizeMantlePrefix,
  prettyMantleModelName,
} from "./bedrockMantleHelpers.js";

describe("mantle URLs", () => {
  it("builds the base URL from region and prefix", () => {
    expect(mantleBaseUrl("us-east-1")).toBe(
      "https://bedrock-mantle.us-east-1.api.aws/v1/",
    );
    expect(mantleBaseUrl("eu-west-1", "/openai/v1")).toBe(
      "https://bedrock-mantle.eu-west-1.api.aws/openai/v1/",
    );
  });

  it("normalises prefixes", () => {
    expect(normalizeMantlePrefix("v1")).toBe("/v1");
    expect(normalizeMantlePrefix("/openai/v1/")).toBe("/openai/v1");
    expect(normalizeMantlePrefix("")).toBeUndefined();
    expect(normalizeMantlePrefix(undefined)).toBeUndefined();
    expect(mantleBaseUrl("us-east-2", "openai/v1")).toBe(
      "https://bedrock-mantle.us-east-2.api.aws/openai/v1/",
    );
  });

  it("alternates between the two documented prefixes", () => {
    expect(alternateMantlePrefix("/v1")).toBe("/openai/v1");
    expect(alternateMantlePrefix("/openai/v1")).toBe("/v1");
  });

  it("knows which regions have Mantle", () => {
    expect(isMantleRegion("us-east-1")).toBe(true);
    expect(isMantleRegion("us-gov-west-1")).toBe(true);
    expect(isMantleRegion("eu-west-3")).toBe(false);
    expect(isMantleRegion("ap-southeast-1")).toBe(false);
    expect(isMantleRegion(undefined)).toBe(false);
  });
});

describe("error classification", () => {
  it("recognises the wrong-route rejection", () => {
    expect(
      isWrongRouteError("model `openai.gpt-x` isn't supported on this route"),
    ).toBe(true);
    expect(isWrongRouteError("some other error")).toBe(false);
  });

  it("detects an unsupported token-limit parameter", () => {
    expect(
      maxTokensParamFromError(
        "Unsupported parameter: 'max_tokens' is not supported with this model",
      ),
    ).toBe("max_completion_tokens");
    expect(
      maxTokensParamFromError("Unsupported parameter: 'max_completion_tokens'"),
    ).toBe("max_tokens");
    expect(maxTokensParamFromError("rate limited")).toBeUndefined();
  });

  it("hints at the right fix", () => {
    expect(
      getMantleErrorHint("model `x` isn't supported on this route", {}),
    ).toContain("mantlePathPrefix");
    expect(
      getMantleErrorHint(
        "getaddrinfo ENOTFOUND bedrock-mantle.eu-west-3.api.aws",
        {
          region: "eu-west-3",
        },
      ),
    ).toContain("isn't available in eu-west-3");
    expect(
      getMantleErrorHint("getaddrinfo ENOTFOUND x", { region: "us-east-1" }),
    ).toContain("network");
    expect(getMantleErrorHint("HTTP 403 Forbidden", {})).toContain(
      "bedrock-mantle:CreateInference",
    );
    expect(getMantleErrorHint("boom", {})).toBeUndefined();
  });
});

describe("mantleModelOptions", () => {
  it("groups by vendor, dedupes and sorts", () => {
    const opts = mantleModelOptions([
      "qwen.qwen3-coder",
      "openai.gpt-oss-120b",
      "openai.gpt-oss-20b",
      "openai.gpt-oss-20b",
      "weird",
    ]);
    expect(opts.map((o) => o.id)).toEqual([
      "openai.gpt-oss-120b",
      "openai.gpt-oss-20b",
      "weird",
      "qwen.qwen3-coder",
    ]);
    expect(opts[0].provider).toBe("OpenAI");
    expect(opts[2].provider).toBe("Other");
  });

  it("shows readable names and drops non-chat models", () => {
    const opts = mantleModelOptions([
      "openai.gpt-oss-120b",
      "qwen.qwen3-235b",
      "amazon.titan-embed-text-v2",
      "openai.whisper-large",
    ]);
    expect(opts.map((o) => o.id)).toEqual([
      "openai.gpt-oss-120b",
      "qwen.qwen3-235b",
    ]);
    expect(opts[0].name).toBe("GPT OSS 120B");
    expect(opts[1].name).toBe("Qwen3 235B");
  });
});

describe("prettyMantleModelName", () => {
  it("handles ids without a vendor prefix and version-like tokens", () => {
    expect(prettyMantleModelName("weird")).toBe("Weird");
    expect(prettyMantleModelName("openai.gpt-6.1-sol")).toBe("GPT 6.1 Sol");
  });
});

describe("GUI region list", () => {
  it("lists exactly the Mantle regions in the add-model wizard", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { MANTLE_REGIONS } = await import("./bedrockMantleHelpers.js");
    const file = fileURLToPath(
      new URL(
        "../../../../gui/src/pages/AddNewModel/configs/providers.ts",
        import.meta.url,
      ),
    );
    const source = readFileSync(file, "utf8");
    const block = source.match(/const MANTLE_REGIONS = \[([\s\S]*?)\];/);
    expect(block).toBeTruthy();
    const guiRegions = [...block![1].matchAll(/"([a-z0-9-]+)"/g)].map(
      (m) => m[1],
    );
    expect([...guiRegions].sort()).toEqual([...MANTLE_REGIONS].sort());
  });
});
