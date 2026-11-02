import { resolveModeModels } from "./modeModels";

const chat = [{ title: "Opus" }, { title: "Sonnet" }, { title: "Haiku" }];

describe("resolveModeModels", () => {
  it("returns undefined when not configured", () => {
    expect(resolveModeModels(undefined, chat)).toEqual({
      modeModels: undefined,
      errors: [],
    });
  });

  it("maps model names to titles and keeps reasoning effort", () => {
    const { modeModels, errors } = resolveModeModels(
      {
        plan: { model: "Opus", reasoningEffort: "medium" },
        agent: { model: "Sonnet", reasoningEffort: "low" },
        chat: { model: "Haiku" },
      },
      chat,
    );
    expect(errors).toEqual([]);
    expect(modeModels).toEqual({
      plan: { title: "Opus", reasoningEffort: "medium" },
      agent: { title: "Sonnet", reasoningEffort: "low" },
      chat: { title: "Haiku" },
    });
  });

  it("drops unknown models with a non-fatal error listing the options", () => {
    const { modeModels, errors } = resolveModeModels(
      { plan: { model: "Opus 9" }, agent: { model: "Sonnet" } },
      chat,
    );
    expect(modeModels).toEqual({ agent: { title: "Sonnet" } });
    expect(errors).toHaveLength(1);
    expect(errors[0].fatal).toBe(false);
    expect(errors[0].message).toContain(
      'modeModels.plan: no chat model named "Opus 9"',
    );
    expect(errors[0].message).toContain("Opus, Sonnet, Haiku");
  });
});
