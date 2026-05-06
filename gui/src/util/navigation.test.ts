import { describe, expect, it } from "vitest";
import { buildConfigRoute, CONFIG_ROUTES, ROUTES } from "./navigation";

describe("ROUTES", () => {
  it("should have correct static routes", () => {
    expect(ROUTES.HOME).toBe("/");
    expect(ROUTES.HOME_INDEX).toBe("/index.html");
    expect(ROUTES.CONFIG).toBe("/config");
    expect(ROUTES.THEME).toBe("/theme");
    expect(ROUTES.STATS).toBe("/stats");
  });
});

describe("buildConfigRoute", () => {
  it("should return base config route when no tab is provided", () => {
    expect(buildConfigRoute()).toBe("/config");
    expect(buildConfigRoute(undefined)).toBe("/config");
  });

  it("should return config route with tab query parameter", () => {
    expect(buildConfigRoute("models")).toBe("/config?tab=models");
    expect(buildConfigRoute("rules")).toBe("/config?tab=rules");
    expect(buildConfigRoute("tools")).toBe("/config?tab=tools");
    expect(buildConfigRoute("configs")).toBe("/config?tab=configs");
    expect(buildConfigRoute("organizations")).toBe("/config?tab=organizations");
    expect(buildConfigRoute("indexing")).toBe("/config?tab=indexing");
    expect(buildConfigRoute("settings")).toBe("/config?tab=settings");
    expect(buildConfigRoute("help")).toBe("/config?tab=help");
  });
});

describe("CONFIG_ROUTES", () => {
  it("should have pre-built routes for all tabs", () => {
    expect(CONFIG_ROUTES.MODELS).toBe("/config?tab=models");
    expect(CONFIG_ROUTES.RULES).toBe("/config?tab=rules");
    expect(CONFIG_ROUTES.TOOLS).toBe("/config?tab=tools");
    expect(CONFIG_ROUTES.CONFIGS).toBe("/config?tab=configs");
    expect(CONFIG_ROUTES.ORGANIZATIONS).toBe("/config?tab=organizations");
    expect(CONFIG_ROUTES.INDEXING).toBe("/config?tab=indexing");
    expect(CONFIG_ROUTES.SETTINGS).toBe("/config?tab=settings");
    expect(CONFIG_ROUTES.HELP).toBe("/config?tab=help");
  });
});
