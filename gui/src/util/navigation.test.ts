import { describe, expect, it } from "vitest";
import {
  buildConfigRoute,
  CONFIG_ROUTES,
  ConfigTab,
  ROUTES,
} from "./navigation";

describe("ROUTES", () => {
  it("should have correct home route", () => {
    expect(ROUTES.HOME).toBe("/");
  });

  it("should have correct home index route", () => {
    expect(ROUTES.HOME_INDEX).toBe("/index.html");
  });

  it("should have correct config route", () => {
    expect(ROUTES.CONFIG).toBe("/config");
  });

  it("should have correct theme route", () => {
    expect(ROUTES.THEME).toBe("/theme");
  });

  it("should have correct stats route", () => {
    expect(ROUTES.STATS).toBe("/stats");
  });
});

describe("buildConfigRoute", () => {
  it("should return base config route when no tab is provided", () => {
    expect(buildConfigRoute()).toBe("/config");
  });

  it("should return base config route when undefined is provided", () => {
    expect(buildConfigRoute(undefined)).toBe("/config");
  });

  it("should return config route with models tab", () => {
    expect(buildConfigRoute("models")).toBe("/config?tab=models");
  });

  it("should return config route with rules tab", () => {
    expect(buildConfigRoute("rules")).toBe("/config?tab=rules");
  });

  it("should return config route with tools tab", () => {
    expect(buildConfigRoute("tools")).toBe("/config?tab=tools");
  });

  it("should return config route with configs tab", () => {
    expect(buildConfigRoute("configs")).toBe("/config?tab=configs");
  });

  it("should return config route with organizations tab", () => {
    expect(buildConfigRoute("organizations")).toBe("/config?tab=organizations");
  });

  it("should return config route with indexing tab", () => {
    expect(buildConfigRoute("indexing")).toBe("/config?tab=indexing");
  });

  it("should return config route with settings tab", () => {
    expect(buildConfigRoute("settings")).toBe("/config?tab=settings");
  });

  it("should return config route with help tab", () => {
    expect(buildConfigRoute("help")).toBe("/config?tab=help");
  });

  it("should handle all valid ConfigTab values", () => {
    const allTabs: ConfigTab[] = [
      "models",
      "rules",
      "tools",
      "configs",
      "organizations",
      "indexing",
      "settings",
      "help",
    ];

    allTabs.forEach((tab) => {
      const result = buildConfigRoute(tab);
      expect(result).toBe(`/config?tab=${tab}`);
    });
  });
});

describe("CONFIG_ROUTES", () => {
  it("should have correct MODELS route", () => {
    expect(CONFIG_ROUTES.MODELS).toBe("/config?tab=models");
  });

  it("should have correct RULES route", () => {
    expect(CONFIG_ROUTES.RULES).toBe("/config?tab=rules");
  });

  it("should have correct TOOLS route", () => {
    expect(CONFIG_ROUTES.TOOLS).toBe("/config?tab=tools");
  });

  it("should have correct CONFIGS route", () => {
    expect(CONFIG_ROUTES.CONFIGS).toBe("/config?tab=configs");
  });

  it("should have correct ORGANIZATIONS route", () => {
    expect(CONFIG_ROUTES.ORGANIZATIONS).toBe("/config?tab=organizations");
  });

  it("should have correct INDEXING route", () => {
    expect(CONFIG_ROUTES.INDEXING).toBe("/config?tab=indexing");
  });

  it("should have correct SETTINGS route", () => {
    expect(CONFIG_ROUTES.SETTINGS).toBe("/config?tab=settings");
  });

  it("should have correct HELP route", () => {
    expect(CONFIG_ROUTES.HELP).toBe("/config?tab=help");
  });

  it("should have all expected config route keys", () => {
    const expectedKeys = [
      "MODELS",
      "RULES",
      "TOOLS",
      "CONFIGS",
      "ORGANIZATIONS",
      "INDEXING",
      "SETTINGS",
      "HELP",
    ];
    const actualKeys = Object.keys(CONFIG_ROUTES);
    expect(actualKeys).toEqual(expectedKeys);
  });
});
