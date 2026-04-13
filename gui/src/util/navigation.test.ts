import {
  ROUTES,
  buildConfigRoute,
  CONFIG_ROUTES,
  ConfigTab,
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
    it("should return config route without tab when no tab is provided", () => {
      expect(buildConfigRoute()).toBe("/config");
    });

    it("should return config route without tab when undefined is provided", () => {
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
      expect(buildConfigRoute("organizations")).toBe(
        "/config?tab=organizations",
      );
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

    it("should be readonly/const", () => {
      // TypeScript enforces this at compile time, but we can verify the values are as expected
      const allRoutes = Object.values(CONFIG_ROUTES);
      expect(allRoutes.length).toBe(8);
      allRoutes.forEach((route) => {
        expect(route).toMatch(/^\/config\?tab=/);
      });
    });
  });

  describe("ConfigTab type", () => {
    // These tests verify the type system works correctly by testing valid tab values
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

    it("should include all expected tab values", () => {
      expect(validTabs).toHaveLength(8);
    });

    it("should work with buildConfigRoute for all valid tabs", () => {
      validTabs.forEach((tab) => {
        const route = buildConfigRoute(tab);
        expect(route).toBe(`/config?tab=${tab}`);
      });
    });
  });
});
