import type { ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import { cacheTipKey, cacheTips, globalModelId } from "./cacheTips";

function model(
  provider: string,
  id: string,
  extra: Partial<ModelDescription> = {},
): ModelDescription {
  return {
    title: id,
    provider,
    model: id,
    underlyingProviderName: provider,
    ...extra,
  };
}

const ids = (tips: ReturnType<typeof cacheTips>) => tips.map((t) => t.id);

describe("globalModelId", () => {
  it.each([
    ["us.anthropic.claude-sonnet-4-6", "global.anthropic.claude-sonnet-4-6"],
    ["eu.anthropic.claude-opus-5-5", "global.anthropic.claude-opus-5-5"],
    ["apac.anthropic.claude-haiku-5-5", "global.anthropic.claude-haiku-5-5"],
    ["jp.anthropic.claude-sonnet-5", "global.anthropic.claude-sonnet-5"],
    ["US.anthropic.claude-sonnet-4-6", "global.anthropic.claude-sonnet-4-6"],
  ])("%s -> %s", (from, to) => {
    expect(globalModelId(from)).toBe(to);
  });

  it("leaves IDs without a geographic prefix alone", () => {
    expect(globalModelId("global.anthropic.claude-sonnet-4-6")).toBe(
      "global.anthropic.claude-sonnet-4-6",
    );
    expect(globalModelId("anthropic.claude-sonnet-4-6")).toBe(
      "anthropic.claude-sonnet-4-6",
    );
  });
});

describe("cacheTips: regional premium", () => {
  it("warns, with the global ID to try, for a regional Bedrock model", () => {
    const tips = cacheTips(
      model("bedrock", "us.anthropic.claude-sonnet-4-6"),
      "auto",
    );
    const tip = tips.find((t) => t.id === "regional-premium")!;
    expect(tip.severity).toBe("warning");
    expect(tip.title).toBe("Regional endpoints cost 10% more");
    expect(tip.suggestion).toBe("global.anthropic.claude-sonnet-4-6");
    expect(tip.body).toContain("data residency");
  });

  it.each(["eu", "apac", "jp", "au", "ca"])("also for %s.", (prefix) => {
    const tips = cacheTips(
      model("bedrock", `${prefix}.anthropic.claude-opus-5-5`),
      "5m",
    );
    expect(ids(tips)).toContain("regional-premium");
  });

  it.each([
    ["global.anthropic.claude-sonnet-4-6"],
    ["anthropic.claude-sonnet-4-6"],
    ["us-gov.anthropic.claude-sonnet-4-6"],
    // earlier models keep their existing pricing
    ["us.anthropic.claude-opus-4-1-20250805-v1:0"],
    ["us.anthropic.claude-3-7-sonnet-20250219-v1:0"],
  ])("says nothing for %s", (id) => {
    expect(ids(cacheTips(model("bedrock", id), "5m"))).not.toContain(
      "regional-premium",
    );
  });

  it("says nothing for other providers", () => {
    expect(cacheTips(model("anthropic", "claude-sonnet-4-6"), "auto")).toEqual(
      [],
    );
    expect(cacheTips(model("openai", "gpt-4o"), "auto")).toEqual([]);
  });

  it("applies whether or not caching is on", () => {
    expect(
      ids(cacheTips(model("bedrock", "us.anthropic.claude-sonnet-4-6"), "off")),
    ).toContain("regional-premium");
  });

  it("returns nothing without a model", () => {
    expect(cacheTips(undefined, "auto")).toEqual([]);
    expect(cacheTips(null, "auto")).toEqual([]);
  });
});

describe("cacheTips: 1 hour not available", () => {
  // Sonnet 4.5 is not in the AWS table, so it takes no 1-hour ttl
  const noHour = "global.anthropic.claude-sonnet-4-5-20250929-v1:0";

  it("warns when 1 hour is chosen for a model that cannot take it", () => {
    const tip = cacheTips(model("bedrock", noHour), "1h").find(
      (t) => t.id === "one-hour-unavailable",
    )!;
    expect(tip.severity).toBe("warning");
    expect(tip.title).toBe("1 hour is not available for this model");
  });

  it("is only a note under Auto", () => {
    const tip = cacheTips(model("bedrock", noHour), "auto").find(
      (t) => t.id === "one-hour-unavailable",
    )!;
    expect(tip.severity).toBe("info");
  });

  it("says nothing for 5 minutes, for off, or for a model that takes 1 hour", () => {
    expect(ids(cacheTips(model("bedrock", noHour), "5m"))).toEqual([]);
    expect(ids(cacheTips(model("bedrock", noHour), "off"))).toEqual([]);
    expect(
      ids(
        cacheTips(model("bedrock", "global.anthropic.claude-sonnet-4-6"), "1h"),
      ),
    ).toEqual([]);
  });

  it("follows the config when there is no toolbar choice", () => {
    const cfg = (ttl: string) =>
      model("bedrock", noHour, {
        completionOptions: { promptCaching: true },
        cacheBehavior: { ttl },
      } as any);
    expect(ids(cacheTips(cfg("1h"), undefined))).toContain(
      "one-hour-unavailable",
    );
    expect(ids(cacheTips(cfg("5m"), undefined))).toEqual([]);
    // config with caching off: nothing to warn about
    expect(
      ids(
        cacheTips(
          model("bedrock", noHour, { cacheBehavior: { ttl: "1h" } } as any),
          undefined,
        ),
      ),
    ).toEqual([]);
  });
});

describe("cacheTips: both at once", () => {
  it("lists the premium first", () => {
    const tips = cacheTips(
      model("bedrock", "us.anthropic.claude-sonnet-4-5-20250929-v1:0"),
      "1h",
    );
    expect(ids(tips)).toEqual(["regional-premium", "one-hour-unavailable"]);
  });
});

describe("cacheTipKey", () => {
  it("is per model and tip", () => {
    expect(cacheTipKey("A", "x")).not.toBe(cacheTipKey("B", "x"));
    expect(cacheTipKey("A", "x")).not.toBe(cacheTipKey("A", "y"));
  });
});
