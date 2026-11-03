import { describe, expect, it } from "vitest";
import {
  buildUpdate,
  draftFromConfig,
  hasChanges,
  setDefault,
  setEffort,
  toggleOffered,
} from "./modeModelsDraft";

const cfg = (modeModels: any) => ({ modeModels });

describe("draftFromConfig", () => {
  it("is empty for every mode with no modeModels", () => {
    const d = draftFromConfig({});
    expect(d.plan).toEqual({
      offered: [],
      defaultTitle: undefined,
      effort: undefined,
      implicitAll: false,
    });
    expect(d.chat.offered).toEqual([]);
  });

  it("reads an explicit list, default first", () => {
    const d = draftFromConfig(
      cfg({ plan: { title: "B", titles: ["B", "A"], reasoningEffort: "low" } }),
    );
    expect(d.plan).toEqual({
      offered: ["B", "A"],
      defaultTitle: "B",
      effort: "low",
      implicitAll: false,
    });
  });

  it("shows a lone default as ticked and marks it implicit", () => {
    const d = draftFromConfig(cfg({ agent: { title: "A" } }));
    expect(d.agent).toMatchObject({
      offered: ["A"],
      defaultTitle: "A",
      implicitAll: true,
    });
  });
});

describe("toggleOffered / setDefault", () => {
  const empty = draftFromConfig({}).plan;

  it("the first ticked model becomes the default", () => {
    const d = toggleOffered(empty, "A", true);
    expect(d.defaultTitle).toBe("A");
    expect(d.offered).toEqual(["A"]);
  });

  it("further ticks append and keep the default first", () => {
    let d = toggleOffered(empty, "A", true);
    d = toggleOffered(d, "B", true);
    d = toggleOffered(d, "C", true);
    expect(d.offered).toEqual(["A", "B", "C"]);
    expect(d.defaultTitle).toBe("A");
  });

  it("ticking the same model twice does not duplicate it", () => {
    let d = toggleOffered(empty, "A", true);
    d = toggleOffered(d, "A", true);
    expect(d.offered).toEqual(["A"]);
  });

  it("unticking the default promotes the next one", () => {
    let d = toggleOffered(toggleOffered(empty, "A", true), "B", true);
    d = toggleOffered(d, "A", false);
    expect(d.offered).toEqual(["B"]);
    expect(d.defaultTitle).toBe("B");
  });

  it("unticking everything leaves no default", () => {
    const d = toggleOffered(toggleOffered(empty, "A", true), "A", false);
    expect(d.offered).toEqual([]);
    expect(d.defaultTitle).toBeUndefined();
  });

  it("making a model the default ticks it and moves it first", () => {
    let d = toggleOffered(toggleOffered(empty, "A", true), "B", true);
    d = setDefault(d, "B");
    expect(d.defaultTitle).toBe("B");
    expect(d.offered).toEqual(["B", "A"]);
    d = setDefault(d, "C");
    expect(d.offered).toEqual(["C", "B", "A"]);
  });

  it("an implicit mode becomes explicit once a second model is ticked", () => {
    const implicit = draftFromConfig(cfg({ agent: { title: "A" } })).agent;
    expect(toggleOffered(implicit, "B", true).implicitAll).toBe(false);
  });
});

describe("buildUpdate", () => {
  it("is empty when nothing changed", () => {
    const d = draftFromConfig(
      cfg({ plan: { title: "A", titles: ["A", "B"] } }),
    );
    expect(buildUpdate(d, d)).toEqual({});
    expect(hasChanges(buildUpdate(d, d))).toBe(false);
  });

  it("writes a list when two or more are ticked", () => {
    const before = draftFromConfig({});
    const after = {
      ...before,
      plan: toggleOffered(toggleOffered(before.plan, "A", true), "B", true),
    };
    expect(buildUpdate(before, after)).toEqual({
      plan: { model: "A", models: ["A", "B"] },
    });
  });

  it("one ticked model on a mode with no list is a plain model:", () => {
    const before = draftFromConfig({});
    const after = { ...before, agent: toggleOffered(before.agent, "A", true) };
    expect(buildUpdate(before, after)).toEqual({ agent: { model: "A" } });
  });

  it("keeps an explicit list even when it shrinks to one", () => {
    const before = draftFromConfig(
      cfg({ plan: { title: "A", titles: ["A", "B"] } }),
    );
    const after = { ...before, plan: toggleOffered(before.plan, "B", false) };
    expect(buildUpdate(before, after)).toEqual({
      plan: { model: "A", models: ["A"] },
    });
  });

  it("removes the entry when everything is unticked", () => {
    const before = draftFromConfig(
      cfg({ plan: { title: "A", titles: ["A", "B"] } }),
    );
    let plan = toggleOffered(before.plan, "A", false);
    plan = toggleOffered(plan, "B", false);
    expect(buildUpdate(before, { ...before, plan })).toEqual({ plan: null });
  });

  it("sends only the modes that changed", () => {
    const before = draftFromConfig(
      cfg({ plan: { title: "A", titles: ["A", "B"] }, agent: { title: "B" } }),
    );
    const after = { ...before, plan: setDefault(before.plan, "B") };
    const update = buildUpdate(before, after);
    expect(Object.keys(update)).toEqual(["plan"]);
    expect(update.plan).toEqual({ model: "B", models: ["B", "A"] });
  });

  it("sends the effort only when it changed, and null to clear it", () => {
    const before = draftFromConfig(
      cfg({ plan: { title: "A", titles: ["A"], reasoningEffort: "low" } }),
    );
    expect(
      buildUpdate(before, { ...before, plan: setEffort(before.plan, "high") }),
    ).toEqual({ plan: { model: "A", models: ["A"], reasoningEffort: "high" } });
    expect(
      buildUpdate(before, {
        ...before,
        plan: setEffort(before.plan, undefined),
      }),
    ).toEqual({ plan: { model: "A", models: ["A"], reasoningEffort: null } });
  });

  it("changing only the effort does not rewrite the list of a plain mode", () => {
    const before = draftFromConfig(cfg({ agent: { title: "A" } }));
    const update = buildUpdate(before, {
      ...before,
      agent: setEffort(before.agent, "medium"),
    });
    expect(update).toEqual({
      agent: { model: "A", reasoningEffort: "medium" },
    });
  });
});
