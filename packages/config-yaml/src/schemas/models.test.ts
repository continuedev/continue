import { modelRolesSchema, modelSchema } from "./models.js";

describe("model schemas", () => {
  it("accepts the commitMessage role", () => {
    const parsedRole = modelRolesSchema.parse("commitMessage");
    expect(parsedRole).toBe("commitMessage");
  });

  it("retains custom commitMessage prompt templates", () => {
    const parsedModel = modelSchema.parse({
      name: "test",
      model: "test-model",
      provider: "openai",
      promptTemplates: { commitMessage: "custom prompt" },
    });

    const promptTemplates = parsedModel.promptTemplates as Record<
      string,
      string | undefined
    >;

    expect(promptTemplates.commitMessage).toBe("custom prompt");
  });

  it("allows an empty promptTemplates object", () => {
    expect(() =>
      modelSchema.parse({
        name: "test",
        model: "test-model",
        provider: "openai",
        promptTemplates: {},
      }),
    ).not.toThrow();
  });
});
