import Handlebars from "handlebars";
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
import { NextEditTemplate, TemplateVars } from "../types";

// Keep the template registry
export const NEXT_EDIT_MODEL_TEMPLATES: Record<
  NEXT_EDIT_MODELS,
  NextEditTemplate
> = {
  "mercury-coder": {
    template: `${MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_OPEN}\n{{{recentlyViewedCodeSnippets}}}\n${MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_CLOSE}\n\n${MERCURY_CURRENT_FILE_CONTENT_OPEN}\ncurrent_file_path: {{{currentFilePath}}}\n{{{currentFileContent}}}\n${MERCURY_CURRENT_FILE_CONTENT_CLOSE}\n\n${MERCURY_EDIT_DIFF_HISTORY_OPEN}\n{{{editDiffHistory}}}\n${MERCURY_EDIT_DIFF_HISTORY_CLOSE}\n`,
  },
  instinct: {
    template: `${INSTINCT_USER_PROMPT_PREFIX}\n\n### Context:\n{{{contextSnippets}}}\n\n### User Edits:\n\n{{{editDiffHistory}}}\n\n### User Excerpt:\n{{{currentFilePath}}}\n\n{{{currentFileContent}}}\`\`\`\n### Response:`,
  },
};

// Export a utility for providers to use
export class PromptTemplateRenderer {
  private compiledTemplate: HandlebarsTemplateDelegate;

  constructor(template: string) {
    this.compiledTemplate = Handlebars.compile(template);
  }

  render(vars: TemplateVars): string {
    return this.compiledTemplate(vars);
  }
}

// Keep for backward compatibility or remove if not needed
export function getTemplateForModel(modelName: NEXT_EDIT_MODELS): string {
  const template = NEXT_EDIT_MODEL_TEMPLATES[modelName];
  if (!template) {
    throw new Error(`Model ${modelName} is not supported for next edit.`);
  }
  return template.template;
}
