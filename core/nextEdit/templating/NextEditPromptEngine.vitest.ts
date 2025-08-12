import { beforeEach, describe, expect, it } from "vitest";
import { Position } from "../..";
import { SnippetPayload } from "../../autocomplete/snippets";
import { AutocompleteSnippetType } from "../../autocomplete/snippets/types";
import { HelperVars } from "../../autocomplete/util/HelperVars";
import { NEXT_EDIT_MODELS } from "../../llm/constants";
import {
  MERCURY_CURRENT_FILE_CONTENT_CLOSE,
  MERCURY_CURRENT_FILE_CONTENT_OPEN,
  MERCURY_CURSOR,
  MERCURY_EDIT_DIFF_HISTORY_CLOSE,
  MERCURY_EDIT_DIFF_HISTORY_OPEN,
  MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_CLOSE,
  MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_OPEN,
  MODEL_1_USER_CURSOR_IS_HERE_TOKEN,
  MODEL_1_USER_PROMPT_PREFIX,
} from "../constants";
import {
  renderDefaultSystemPrompt,
  renderDefaultUserPrompt,
  renderPrompt,
} from "./NextEditPromptEngine";

describe("NextEditPromptEngine", () => {
  describe("renderPrompt", () => {
    let mercuryHelper: HelperVars;
    let model1Helper: HelperVars;
    let testHelper: HelperVars;
    let unsupportedHelper: HelperVars;
    let ctx: any;

    beforeEach(() => {
      mercuryHelper = {
        modelName: "inception/mercury-coder-nextedit" as NEXT_EDIT_MODELS,
        fileContents: "function test() {\n  const a = 1;\n  return a;\n}",
        pos: { line: 1, character: 12 } as Position,
        lang: { name: "typescript" },
      } as HelperVars;
      model1Helper = {
        modelName: "continuedev/model-1" as NEXT_EDIT_MODELS,
        fileContents: "function test() {\n  const a = 1;\n  return a;\n}",
        pos: { line: 1, character: 12 } as Position,
        lang: { name: "typescript" },
      } as HelperVars;
      unsupportedHelper = {
        modelName: "mistral/codestral" as NEXT_EDIT_MODELS,
        fileContents: "function test() {\n  const a = 1;\n  return a;\n}",
        pos: { line: 1, character: 12 } as Position,
        lang: { name: "typescript" },
      } as HelperVars;

      ctx = {
        recentlyViewedCodeSnippets: [
          { filepath: "/path/to/file1.ts", content: "const b = 2;" },
        ],
        currentFileContent: "function test() {\n  const a = 1;\n  return a;\n}",
        editDiffHistory: "diff --git a/file.ts b/file.ts\n@@ -1,3 +1,4 @@",
        editableRegionStartLine: 0,
        editableRegionEndLine: 3,
        userEdits: "Added constant a",
        languageShorthand: "ts",
        userExcerpts: "const a = 1;",
      };
    });

    it("should render mercury-coder-nextedit prompt correctly", async () => {
      const result = await renderPrompt(mercuryHelper, ctx);

      expect(result).toHaveProperty("prompt");
      expect(result.prompt.role).toBe("user");

      const content = result.prompt.content;
      expect(content).toContain(MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_OPEN);
      expect(content).toContain(MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_CLOSE);
      expect(content).toContain(MERCURY_CURRENT_FILE_CONTENT_OPEN);
      expect(content).toContain(MERCURY_CURRENT_FILE_CONTENT_CLOSE);
      expect(content).toContain(MERCURY_EDIT_DIFF_HISTORY_OPEN);
      expect(content).toContain(MERCURY_EDIT_DIFF_HISTORY_CLOSE);

      expect(result.userEdits).toBe(ctx.editDiffHistory);
      expect(result.userExcerpts).toContain(MERCURY_CURSOR);
    });

    it("should render model-1 prompt correctly", async () => {
      // Create proper model-1 context structure matching NextEditProvider.ts
      const model1Ctx = {
        contextSnippets:
          "+++++ /path/to/context.ts\nconst contextVar = 'test';",
        currentFileContent: model1Helper.fileContents,
        windowStart: 0, // Math.max(0, helper.pos.line - 25)
        windowEnd: 3, // Math.min(helper.fileLines.length - 1, helper.pos.line + 25)
        adjustedEditableStart: 0, // Math.max(0, helper.pos.line - 1) within window
        adjustedEditableEnd: 2, // Math.min(helper.pos.line + 5) within window
        editDiffHistory:
          "diff --git a/file.ts b/file.ts\nindex 123..456 789\n--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,4 @@\n function test() {\n+  const a = 1;\n   return a;\n }", // unified diff
        currentFilePath: "/path/to/file.ts",
        languageShorthand: "ts",
      };

      const result = await renderPrompt(model1Helper, model1Ctx);
      console.log(result);

      expect(result).toHaveProperty("prompt");
      expect(result.prompt.role).toBe("user");
      expect(result.prompt.content).toContain(MODEL_1_USER_PROMPT_PREFIX);
      expect(result.prompt.content).toContain("### Context:");
      expect(result.prompt.content).toContain("### User Edits:");
      expect(result.prompt.content).toContain("### User Excerpts:");
      expect(result.prompt.content).toContain("```ts");

      expect(result.userEdits).toBe(model1Ctx.editDiffHistory);
      expect(result.userExcerpts).toContain(MODEL_1_USER_CURSOR_IS_HERE_TOKEN);
    });

    it("should throw error for unsupported model name", async () => {
      await expect(renderPrompt(unsupportedHelper, ctx)).rejects.toThrow(
        "mistral/codestral is not yet supported for next edit.",
      );
    });
  });

  describe("renderDefaultSystemPrompt", () => {
    it("should return a system prompt with expected role and content", () => {
      const result = renderDefaultSystemPrompt();

      expect(result.role).toBe("system");
      expect(result.content).toContain("You are an expert polyglot developer");
      expect(result.content).toContain("Do not hallucinate.");
    });
  });

  describe("renderDefaultUserPrompt", () => {
    it("should render a user prompt with the correct structure", () => {
      const snippets: SnippetPayload = {
        rootPathSnippets: [
          {
            type: AutocompleteSnippetType.Code,
            filepath: "",
            content: "root path",
          },
        ],
        importDefinitionSnippets: [
          {
            type: AutocompleteSnippetType.Code,
            filepath: "",
            content: "import def",
          },
        ],
        ideSnippets: [
          {
            type: AutocompleteSnippetType.Code,
            filepath: "",
            content: "ide snippets",
          },
        ],
        recentlyEditedRangeSnippets: [
          {
            type: AutocompleteSnippetType.Code,
            filepath: "",
            content: "recent edits",
          },
        ],
        diffSnippets: [
          {
            type: AutocompleteSnippetType.Diff,
            content: "diff snippets",
          },
        ],
        clipboardSnippets: [
          {
            type: AutocompleteSnippetType.Clipboard,
            content: "clipboard",
            copiedAt: new Date().toISOString(),
          },
        ],
        recentlyVisitedRangesSnippets: [
          {
            type: AutocompleteSnippetType.Code,
            filepath: "",
            content: "visited ranges",
          },
        ],
        recentlyOpenedFileSnippets: [
          {
            type: AutocompleteSnippetType.Code,
            filepath: "",
            content: "recently opened files",
          },
        ],
        staticSnippet: [
          {
            type: AutocompleteSnippetType.Static,
            filepath: "",
            content: "static content",
          },
        ],
      };

      const helper: HelperVars = {
        lang: { name: "typescript" },
      } as HelperVars;

      const result = renderDefaultUserPrompt(snippets, helper);

      expect(result.role).toBe("user");
      expect(result.content).toContain("Your junior made the following edit:");
      expect(result.content).toContain("typescript");
      expect(result.content).toContain("root path");
    });
  });

  describe("insertTokens", () => {
    it("should correctly insert cursor and editable region tokens", () => {
      const mercuryHelper = {
        modelName: "inception/mercury-coder-nextedit" as NEXT_EDIT_MODELS,
        fileContents: "function test() {\n  const a = 1;\n  return a;\n}",
        pos: { line: 1, character: 12 } as Position,
        lang: { name: "typescript" },
      } as HelperVars;

      const ctx = {
        recentlyViewedCodeSnippets: [
          { filepath: "/path/to/file1.ts", content: "const b = 2;" },
        ],
        currentFileContent: "function test() {\n  const a = 1;\n  return a;\n}",
        editDiffHistory: "diff --git a/file.ts b/file.ts\n@@ -1,3 +1,4 @@",
        editableRegionStartLine: 0,
        editableRegionEndLine: 3,
        userEdits: "Added constant a",
        languageShorthand: "ts",
        userExcerpts: "const a = 1;",
      };

      return renderPrompt(mercuryHelper, ctx).then((result) => {
        expect(result.userExcerpts).toContain(MERCURY_CURSOR);
      });
    });
  });
});
