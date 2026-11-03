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

  describe("models: list", () => {
    it("leaves titles unset when only `model` is given (unchanged behaviour)", () => {
      const { modeModels } = resolveModeModels(
        { plan: { model: "Opus" } },
        chat,
      );
      expect(modeModels?.plan).toEqual({ title: "Opus" });
    });

    it("puts the default first and keeps the rest in order", () => {
      const { modeModels, errors } = resolveModeModels(
        { plan: { model: "Sonnet", models: ["Opus", "Sonnet", "Haiku"] } },
        chat,
      );
      expect(errors).toEqual([]);
      expect(modeModels?.plan).toEqual({
        title: "Sonnet",
        titles: ["Sonnet", "Opus", "Haiku"],
      });
    });

    it("defaults to the first listed model when `model` is not set", () => {
      const { modeModels } = resolveModeModels(
        { agent: { models: ["Haiku", "Opus"] } },
        chat,
      );
      expect(modeModels?.agent).toEqual({
        title: "Haiku",
        titles: ["Haiku", "Opus"],
      });
    });

    it("always offers the default even when it is not in the list", () => {
      const { modeModels } = resolveModeModels(
        { plan: { model: "Opus", models: ["Sonnet"] } },
        chat,
      );
      expect(modeModels?.plan?.titles).toEqual(["Opus", "Sonnet"]);
    });

    it("removes duplicates", () => {
      const { modeModels } = resolveModeModels(
        { plan: { models: ["Opus", "Opus", "Sonnet", "Opus"] } },
        chat,
      );
      expect(modeModels?.plan?.titles).toEqual(["Opus", "Sonnet"]);
    });

    it("drops unknown names with an error that names the list, keeps the rest", () => {
      const { modeModels, errors } = resolveModeModels(
        { plan: { models: ["Opus", "Nope", "Sonnet"] } },
        chat,
      );
      expect(modeModels?.plan?.titles).toEqual(["Opus", "Sonnet"]);
      expect(errors).toHaveLength(1);
      expect(errors[0].fatal).toBe(false);
      expect(errors[0].message).toContain(
        'modeModels.plan.models: no chat model named "Nope"',
      );
    });

    it("falls back to the first valid listed model if the default is unknown", () => {
      const { modeModels, errors } = resolveModeModels(
        { plan: { model: "Nope", models: ["Sonnet", "Opus"] } },
        chat,
      );
      expect(modeModels?.plan).toEqual({
        title: "Sonnet",
        titles: ["Sonnet", "Opus"],
      });
      expect(errors.map((e) => e.message)).toEqual([
        expect.stringContaining('modeModels.plan: no chat model named "Nope"'),
      ]);
    });

    it("drops the entry when nothing in it exists", () => {
      const { modeModels, errors } = resolveModeModels(
        { plan: { model: "Nope", models: ["Also nope"] } },
        chat,
      );
      expect(modeModels).toBeUndefined();
      expect(errors).toHaveLength(2);
    });

    it("keeps reasoning effort and handles each mode on its own", () => {
      const { modeModels } = resolveModeModels(
        {
          plan: { models: ["Opus", "Sonnet"], reasoningEffort: "high" },
          chat: { model: "Haiku" },
        },
        chat,
      );
      expect(modeModels?.plan?.reasoningEffort).toBe("high");
      expect(modeModels?.chat).toEqual({ title: "Haiku" });
    });
  });
});
