import type { ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import { cacheTips, THROTTLE_TIP_MIN } from "./cacheTips";
import type { RequestFailure } from "./requestFailures";

const model = (provider: string, id: string): ModelDescription => ({
  title: id,
  provider,
  model: id,
  underlyingProviderName: provider,
});
const bedrock = model("bedrock", "global.anthropic.claude-sonnet-4-6");
const anthropic = model("anthropic", "claude-sonnet-4-6");

const failure = (kind: RequestFailure["kind"], at = 0): RequestFailure => ({
  at,
  provider: "bedrock",
  model: "m",
  kind,
});
const throttled = (n: number) =>
  Array.from({ length: n }, (_, i) => failure("throttled", i));

const tip = (
  m: ModelDescription,
  setting: Parameters<typeof cacheTips>[1],
  failures?: RequestFailure[],
) =>
  cacheTips(m, setting, undefined, failures).find(
    (t) => t.id === "throttled-caching-off",
  );

describe("cacheTips: throttled with caching off", () => {
  it("appears once the conversation was throttled enough times with caching off", () => {
    const t = tip(bedrock, "off", throttled(THROTTLE_TIP_MIN));
    expect(t?.severity).toBe("warning");
    expect(t?.title).toBe(
      `Throttled ${THROTTLE_TIP_MIN} times with caching off`,
    );
    expect(t?.body).toContain("Bedrock");
  });

  it("names Anthropic for an Anthropic model", () => {
    expect(tip(anthropic, "off", throttled(3))?.body).toContain("Anthropic");
  });

  it("promises no more than the documents say", () => {
    const body = tip(bedrock, "off", throttled(2))!.body;
    expect(body).toContain("can reduce how often");
    expect(body).toContain("will not stop throttling by itself");
    expect(body.toLowerCase()).not.toContain("global");
  });

  it("is quiet below the threshold", () => {
    expect(
      tip(bedrock, "off", throttled(THROTTLE_TIP_MIN - 1)),
    ).toBeUndefined();
    expect(tip(bedrock, "off", [])).toBeUndefined();
    expect(tip(bedrock, "off", undefined)).toBeUndefined();
  });

  it("is quiet when caching is on, whatever the lifetime", () => {
    for (const s of ["5m", "1h", "auto"] as const) {
      expect(tip(bedrock, s, throttled(5))).toBeUndefined();
    }
  });

  it("counts only throttling, not overloaded or other errors", () => {
    const mixed = [
      failure("overloaded"),
      failure("overloaded"),
      failure("other"),
      failure("other"),
      failure("throttled"),
    ];
    expect(tip(bedrock, "off", mixed)).toBeUndefined();
  });

  it("is quiet for models the cache button does not cover (OpenAI counts cached tokens)", () => {
    expect(tip(model("openai", "gpt-4o"), "off", throttled(5))).toBeUndefined();
    expect(
      tip(model("bedrock", "us.amazon.nova-pro-v1:0"), "off", throttled(5)),
    ).toBeUndefined();
  });

  it("applies when no setting was chosen and config does not turn caching on", () => {
    // Caching is off unless config.yaml enables it, so this is the default case.
    expect(tip(anthropic, undefined, throttled(3))).toBeDefined();
  });

  it("is quiet when config.yaml turns caching on and no setting was chosen", () => {
    const configured = {
      ...anthropic,
      cacheBehavior: { cacheConversation: true },
    };
    expect(tip(configured, undefined, throttled(5))).toBeUndefined();
    const viaFlag = { ...bedrock, completionOptions: { promptCaching: true } };
    expect(tip(viaFlag, undefined, throttled(5))).toBeUndefined();
  });
});
