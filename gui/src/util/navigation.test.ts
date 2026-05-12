import {
  buildConfigRoute,
  CONFIG_ROUTES,
  ConfigTab,
  ROUTES,
} from "./navigation";

describe("navigation utilities", () => {
  describe("ROUTES", () => {
    it("should have correct HOME route", () => {
      expect(ROUTES.HOME).toBe("/");
    });

    it("should have correct HOME_INDEX route", () => {
      expect(ROUTES.HOME_INDEX).toBe("/index.html");
    });

    it("should have correct CONFIG route", () => {
      expect(ROUTES.CONFIG).toBe("/config");
    });

    it("should have correct THEME route", () => {
      expect(ROUTES.THEME).toBe("/theme");
    });

    it("should have correct STATS route", () => {
      expect(ROUTES.STATS).toBe("/stats");
    });
  });

  describe("buildConfigRoute", () => {
    it("should return base config route when no tab is provided", () => {
      expect(buildConfigRoute()).toBe("/config");
    });

    it("should return base config route when undefined is passed", () => {
      expect(buildConfigRoute(undefined)).toBe("/config");
    });

    it("should build correct route for models tab", () => {
      expect(buildConfigRoute("models")).toBe("/config?tab=models");
    });

    it("should build correct route for rules tab", () => {
      expect(buildConfigRoute("rules")).toBe("/config?tab=rules");
    });

    it("should build correct route for tools tab", () => {
      expect(buildConfigRoute("tools")).toBe("/config?tab=tools");
    });

    it("should build correct route for configs tab", () => {
      expect(buildConfigRoute("configs")).toBe("/config?tab=configs");
    });

    it("should build correct route for organizations tab", () => {
      expect(buildConfigRoute("organizations")).toBe(
        "/config?tab=organizations",
      );
    });

    it("should build correct route for indexing tab", () => {
      expect(buildConfigRoute("indexing")).toBe("/config?tab=indexing");
    });

    it("should build correct route for settings tab", () => {
      expect(buildConfigRoute("settings")).toBe("/config?tab=settings");
    });

    it("should build correct route for help tab", () => {
      expect(buildConfigRoute("help")).toBe("/config?tab=help");
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
  });

  describe("ConfigTab type", () => {
    it("should allow all valid tab values", () => {
      const validTabs: ConfigTab[] = [
        "models",
        "rules",
        "tools",
        "configs",
        "organizations",
        "indexing",
        "settings",
        "help",
      ];

      validTabs.forEach((tab) => {
        expect(buildConfigRoute(tab)).toContain(`tab=${tab}`);
      });
    });
  });
});
