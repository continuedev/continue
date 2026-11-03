import { cacheBehaviorSchema, modelSchema } from "./schemas/models.js";

describe("cacheBehavior.ttl", () => {
  it.each(["auto", "5m", "1h"])("accepts %s", (ttl) => {
    expect(cacheBehaviorSchema.parse({ ttl })).toEqual({ ttl });
  });

  it("is optional and does not change the existing fields", () => {
    expect(
      cacheBehaviorSchema.parse({
        cacheSystemMessage: true,
        cacheConversation: false,
      }),
    ).toEqual({ cacheSystemMessage: true, cacheConversation: false });
  });

  it.each(["30m", "1H", "", 3600])("rejects %p", (ttl) => {
    expect(cacheBehaviorSchema.safeParse({ ttl }).success).toBe(false);
  });

  it("is accepted on a model", () => {
    const parsed = modelSchema.parse({
      name: "Claude",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      cacheBehavior: { ttl: "1h" },
    });
    expect(parsed.cacheBehavior).toEqual({ ttl: "1h" });
  });
});
