import { describe, expect, it } from "vitest";
import { PromptTemplate } from "..";
import { serializePromptTemplates } from "./util";

describe("serializePromptTemplates", () => {
  it("should return undefined for undefined input", () => {
    expect(serializePromptTemplates(undefined)).toBeUndefined();
  });

  it("should convert function templates to empty strings", () => {
    const functionTemplate: PromptTemplate = () => "Generated template";
    const templates: Record<string, PromptTemplate> = {
      template1: functionTemplate,
    };

    const result = serializePromptTemplates(templates);

    expect(result).toEqual({ template1: "" });
  });

  it("should pass through string templates unchanged", () => {
    const templates: Record<string, PromptTemplate> = {
      template1: "This is a static template",
      template2: "Another static template",
    };

    const result = serializePromptTemplates(templates);

    expect(result).toEqual(templates);
  });

  it("should handle mixed template types", () => {
    const functionTemplate: PromptTemplate = () => "Generated template";
    const templates: Record<string, PromptTemplate> = {
      function: functionTemplate,
      string: "This is a static template",
    };

    const result = serializePromptTemplates(templates);

    expect(result).toEqual({
      function: "",
      string: "This is a static template",
    });
  });
});
