import type { ModelDescription } from "core";
import { describe, expect, it } from "vitest";
import {
  cachingIsDefaulted,
  configSilentOnCaching,
  effectiveCacheSetting,
} from "./promptCache";

const base = {
  title: "m",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  underlyingProviderName: "anthropic",
};
const m = (extra: object = {}): ModelDescription =>
  ({ ...base, ...extra }) as ModelDescription;

describe("configSilentOnCaching", () => {
  it("is true when config sets nothing about caching", () => {
    expect(configSilentOnCaching(m())).toBe(true);
  });

  it.each([
    ["promptCaching true", { completionOptions: { promptCaching: true } }],
    ["promptCaching false", { completionOptions: { promptCaching: false } }],
    ["cacheConversation true", { cacheBehavior: { cacheConversation: true } }],
    [
      "cacheConversation false",
      { cacheBehavior: { cacheConversation: false } },
    ],
    [
      "cacheSystemMessage true",
      { cacheBehavior: { cacheSystemMessage: true } },
    ],
    [
      "cacheSystemMessage false",
      { cacheBehavior: { cacheSystemMessage: false } },
    ],
  ])("is false once config says %s", (_name, extra) => {
    expect(configSilentOnCaching(m(extra))).toBe(false);
  });

  it("is still true when config sets only a lifetime, which does not turn caching on", () => {
    expect(configSilentOnCaching(m({ cacheBehavior: { ttl: "1h" } }))).toBe(
      true,
    );
  });
});

describe("effectiveCacheSetting: the default", () => {
  it.each(["agent", "plan", "background"])(
    "is Auto in %s when nothing is chosen and config is silent",
    (mode) => {
      expect(effectiveCacheSetting(m(), undefined, mode)).toBe("auto");
    },
  );

  it("is off in Chat, and when the mode is unknown", () => {
    expect(effectiveCacheSetting(m(), undefined, "chat")).toBeUndefined();
    expect(effectiveCacheSetting(m(), undefined, undefined)).toBeUndefined();
  });

  it("follows a lifetime config.yaml names", () => {
    const ttl = (t: string) => m({ cacheBehavior: { ttl: t } });
    expect(effectiveCacheSetting(ttl("1h"), undefined, "agent")).toBe("1h");
    expect(effectiveCacheSetting(ttl("5m"), undefined, "agent")).toBe("5m");
  });

  it("never overrides a toolbar choice, including Off", () => {
    for (const choice of ["off", "5m", "1h", "auto"] as const) {
      expect(effectiveCacheSetting(m(), choice, "agent")).toBe(choice);
    }
  });
});
