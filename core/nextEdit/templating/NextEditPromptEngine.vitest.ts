import { describe, expect, it } from "vitest";
import { NEXT_EDIT_MODELS } from "../../llm/constants";
import {
  INSTINCT_USER_PROMPT_PREFIX,
  MERCURY_CURRENT_FILE_CONTENT_CLOSE,
  MERCURY_CURRENT_FILE_CONTENT_OPEN,
  MERCURY_EDIT_DIFF_HISTORY_CLOSE,
  MERCURY_EDIT_DIFF_HISTORY_OPEN,
  MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_CLOSE,
  MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_OPEN,
} from "../constants";
import {
  NEXT_EDIT_MODEL_TEMPLATES,
  PromptTemplateRenderer,
  getTemplateForModel,
} from "./NextEditPromptEngine";

describe("NextEditPromptEngine", () => {
  describe("NEXT_EDIT_MODEL_TEMPLATES", () => {
    it("should contain templates for all supported models", () => {
      expect(NEXT_EDIT_MODEL_TEMPLATES).toHaveProperty(
        NEXT_EDIT_MODELS.MERCURY_CODER,
      );
      expect(NEXT_EDIT_MODEL_TEMPLATES).toHaveProperty(
        NEXT_EDIT_MODELS.INSTINCT,
      );
    });

    it("mercury-coder template should contain expected tokens", () => {
      const template =
        NEXT_EDIT_MODEL_TEMPLATES[NEXT_EDIT_MODELS.MERCURY_CODER].template;

      expect(template).toContain(MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_OPEN);
      expect(template).toContain(MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_CLOSE);
      expect(template).toContain(MERCURY_CURRENT_FILE_CONTENT_OPEN);
      expect(template).toContain(MERCURY_CURRENT_FILE_CONTENT_CLOSE);
      expect(template).toContain(MERCURY_EDIT_DIFF_HISTORY_OPEN);
      expect(template).toContain(MERCURY_EDIT_DIFF_HISTORY_CLOSE);
      expect(template).toContain("{{{recentlyViewedCodeSnippets}}}");
      expect(template).toContain("{{{currentFileContent}}}");
      expect(template).toContain("{{{editDiffHistory}}}");
      expect(template).toContain("{{{currentFilePath}}}");
    });

    it("instinct template should contain expected tokens", () => {
      const template =
        NEXT_EDIT_MODEL_TEMPLATES[NEXT_EDIT_MODELS.INSTINCT].template;

      expect(template).toContain(INSTINCT_USER_PROMPT_PREFIX);
      expect(template).toContain("### Context:");
      expect(template).toContain("### User Edits:");
      expect(template).toContain("### User Excerpt:");
      expect(template).toContain("{{{contextSnippets}}}");
      expect(template).toContain("{{{currentFileContent}}}");
      expect(template).toContain("{{{editDiffHistory}}}");
      expect(template).toContain("{{{currentFilePath}}}");
    });
  });

  describe("PromptTemplateRenderer", () => {
    it("should render a template with provided variables", () => {
      const template = "Hello {{{name}}}, you have {{{count}}} messages";
      const renderer = new PromptTemplateRenderer(template);

      const result = renderer.render({
        name: "Alice",
        count: "5",
      });

      expect(result).toBe("Hello Alice, you have 5 messages");
    });

    it("should handle missing variables gracefully", () => {
      const template = "Hello {{{name}}}";
      const renderer = new PromptTemplateRenderer(template);

      const result = renderer.render({});

      expect(result).toBe("Hello ");
    });

    it("should render complex templates correctly", () => {
      const template =
        NEXT_EDIT_MODEL_TEMPLATES[NEXT_EDIT_MODELS.MERCURY_CODER].template;
      const renderer = new PromptTemplateRenderer(template);

      const result = renderer.render({
        recentlyViewedCodeSnippets: "snippet1",
        currentFileContent: "file content",
        editDiffHistory: "diff history",
        currentFilePath: "file.py",
      });

      expect(result).toContain("snippet1");
      expect(result).toContain("file content");
      expect(result).toContain("diff history");
      expect(result).toContain("current_file_path: file.py");
    });
  });

  describe("getTemplateForModel", () => {
    it("should return the correct template for a supported model", () => {
      const template = getTemplateForModel(NEXT_EDIT_MODELS.MERCURY_CODER);
      expect(template).toBe(
        NEXT_EDIT_MODEL_TEMPLATES[NEXT_EDIT_MODELS.MERCURY_CODER].template,
      );
    });

    it("should throw an error for an unsupported model", () => {
      expect(() =>
        getTemplateForModel("unsupported" as NEXT_EDIT_MODELS),
      ).toThrow("Model unsupported is not supported for next edit.");
    });
  });
});
