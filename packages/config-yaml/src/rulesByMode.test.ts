import { configYamlSchema, rulesByModeSchema } from "./schemas/index.js";

describe("rulesByMode schema", () => {
  it("accepts a boolean per mode", () => {
    expect(
      rulesByModeSchema.parse({ chat: false, plan: false, agent: true }),
    ).toEqual({ chat: false, plan: false, agent: true });
  });

  it("allows modes to be left out", () => {
    expect(rulesByModeSchema.parse({ chat: false })).toEqual({ chat: false });
    expect(rulesByModeSchema.parse({})).toEqual({});
  });

  it("rejects non-boolean values", () => {
    expect(() => rulesByModeSchema.parse({ chat: "off" })).toThrow();
  });

  it("is part of config.yaml", () => {
    const parsed = configYamlSchema.parse({
      name: "x",
      version: "1.0.0",
      rulesByMode: { agent: false },
    });
    expect(parsed.rulesByMode).toEqual({ agent: false });
  });
});
