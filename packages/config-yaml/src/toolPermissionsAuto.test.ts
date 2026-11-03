import { mergeToolPermissions } from "./load/merge.js";
import { toolPermissionsSchema } from "./schemas/index.js";
import { modelSchema } from "./schemas/models.js";

describe("toolPermissions.auto (reviewer settings)", () => {
  it("accepts environment, guidance and limits, each optional", () => {
    const parsed = toolPermissionsSchema.parse({
      auto: {
        environment: {
          trustedDomains: ["github.com"],
          productionMarkers: ["prod"],
        },
        guidance: { block: ["Never run migrations"] },
        limits: { consecutiveDenials: 3 },
      },
    });
    expect(parsed.auto?.limits?.totalDenials).toBeUndefined();
    expect(parsed.auto?.guidance?.allow).toBeUndefined();
    expect(toolPermissionsSchema.parse({ auto: {} }).auto).toEqual({});
  });

  it("rejects limits that are not whole numbers of at least 1", () => {
    for (const bad of [0, -1, 2.5]) {
      expect(() =>
        toolPermissionsSchema.parse({
          auto: { limits: { totalDenials: bad } },
        }),
      ).toThrow();
    }
  });

  it("concatenates lists and keeps the lower limit when merging", () => {
    const merged = mergeToolPermissions(
      {
        auto: {
          environment: { productionMarkers: ["prod"] },
          guidance: { block: ["a"] },
          limits: { consecutiveDenials: 5, totalDenials: 10 },
        },
      },
      {
        auto: {
          environment: {
            productionMarkers: ["prod", "live"],
            trustedDomains: ["x.io"],
          },
          guidance: { allow: ["b"], block: ["a", "c"] },
          limits: { consecutiveDenials: 2 },
        },
      },
    );
    expect(merged?.auto).toEqual({
      environment: {
        trustedDomains: ["x.io"],
        productionMarkers: ["prod", "live"],
      },
      guidance: { block: ["a", "c"], allow: ["b"] },
      limits: { consecutiveDenials: 2, totalDenials: 10 },
    });
  });

  it("keeps auto when only one side has it, and drops it when empty", () => {
    expect(
      mergeToolPermissions(
        { auto: { limits: { totalDenials: 4 } } },
        undefined,
      ),
    ).toEqual({ auto: { limits: { totalDenials: 4 } } });
    expect(mergeToolPermissions({ auto: {} }, { auto: {} })).toBeUndefined();
  });
});

describe("reviewer model role", () => {
  it("is a valid role in a model entry", () => {
    const m = modelSchema.parse({
      name: "r",
      provider: "openai",
      model: "gpt-4.1-mini",
      roles: ["reviewer"],
    });
    expect(m.roles).toEqual(["reviewer"]);
  });
});
