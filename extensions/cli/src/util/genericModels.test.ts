import { describe, expect, it } from "vitest";

import {
  getAllGenericModels,
  isGenericModelId,
  resolveModelSlug,
} from "./genericModels.js";

describe("genericModels", () => {
  describe("resolveModelSlug", () => {
    it("should resolve claude-haiku to anthropic/claude-haiku-4-5", () => {
      expect(resolveModelSlug("claude-haiku")).toBe(
        "anthropic/claude-haiku-4-5",
      );
    });

    it("should resolve claude-sonnet to anthropic/claude-sonnet-4-5", () => {
      expect(resolveModelSlug("claude-sonnet")).toBe(
        "anthropic/claude-sonnet-4-5",
      );
    });

    it("should resolve claude-opus to anthropic/claude-opus-4-5", () => {
      expect(resolveModelSlug("claude-opus")).toBe("anthropic/claude-opus-4-5");
    });

    it("should pass through slugs that already contain /", () => {
      expect(resolveModelSlug("anthropic/claude-haiku-4-5")).toBe(
        "anthropic/claude-haiku-4-5",
      );
      expect(resolveModelSlug("openai/gpt-4")).toBe("openai/gpt-4");
    });

    it("should pass through unknown model IDs unchanged", () => {
      expect(resolveModelSlug("unknown-model")).toBe("unknown-model");
      expect(resolveModelSlug("gpt-4")).toBe("gpt-4");
    });
  });

  describe("isGenericModelId", () => {
    it("should return true for known generic model IDs", () => {
      expect(isGenericModelId("claude-haiku")).toBe(true);
      expect(isGenericModelId("claude-sonnet")).toBe(true);
      expect(isGenericModelId("claude-opus")).toBe(true);
    });

    it("should return false for unknown model IDs", () => {
      expect(isGenericModelId("unknown-model")).toBe(false);
      expect(isGenericModelId("gpt-4")).toBe(false);
      expect(isGenericModelId("anthropic/claude-haiku-4-5")).toBe(false);
    });
  });

  describe("getAllGenericModels", () => {
    it("should return all defined generic models", () => {
      const models = getAllGenericModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.id === "claude-haiku")).toBe(true);
      expect(models.some((m) => m.id === "claude-sonnet")).toBe(true);
      expect(models.some((m) => m.id === "claude-opus")).toBe(true);
    });

    it("should include all required fields for each model", () => {
      const models = getAllGenericModels();
      for (const model of models) {
        expect(model.id).toBeDefined();
        expect(model.displayName).toBeDefined();
        expect(model.provider).toBeDefined();
        expect(model.description).toBeDefined();
        expect(model.currentModelPackageSlug).toBeDefined();
        expect(model.currentModelPackageSlug).toContain("/");
      }
    });
  });
});
