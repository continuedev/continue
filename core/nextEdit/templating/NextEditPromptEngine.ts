import Handlebars from "handlebars";
import { Position } from "../..";
import { SnippetPayload } from "../../autocomplete/snippets";
import { HelperVars } from "../../autocomplete/util/HelperVars";
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
  InstinctTemplateVars,
  MercuryTemplateVars,
  NextEditTemplate,
  PromptMetadata,
  SystemPrompt,
  TemplateVars,
  UserPrompt,
} from "../types";
import {
  contextSnippetsBlock,
  currentFileContentBlock as instinctCurrentFileContentBlock,
  editHistoryBlock as instinctEditHistoryBlock,
} from "./instinct";
import {
  currentFileContentBlock,
  editHistoryBlock,
  recentlyViewedCodeSnippetsBlock,
} from "./mercuryCoderNextEdit";
import {
  insertCursorToken,
  insertEditableRegionTokensWithStaticRange,
} from "./utils";

type TemplateRenderer = (vars: TemplateVars) => string;

const NEXT_EDIT_MODEL_TEMPLATES: Record<NEXT_EDIT_MODELS, NextEditTemplate> = {
  "mercury-coder-nextedit": {
    template: `${MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_OPEN}\n{{{recentlyViewedCodeSnippets}}}\n${MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_CLOSE}\n\n${MERCURY_CURRENT_FILE_CONTENT_OPEN}\n{{{currentFileContent}}}\n${MERCURY_CURRENT_FILE_CONTENT_CLOSE}\n\n${MERCURY_EDIT_DIFF_HISTORY_OPEN}\n{{{editDiffHistory}}}\n${MERCURY_EDIT_DIFF_HISTORY_CLOSE}\n\nThe developer was working on a section of code within the tags \`<|code_to_edit|>\` in the file located at {{{currentFilePath}}}.\nUsing the given \`recently_viewed_code_snippets\`, \`current_file_content\`, \`edit_diff_history\`, and the cursor position marked as \`<|cursor|>\`, please continue the developer's work. Update the \`code_to_edit\` section by predicting and completing the changes they would have made next. Provide the revised code that was between the \`<|code_to_edit|>\` and \`<|/code_to_edit|>\` tags, including the tags themselves.`,
  },
  instinct: {
    template: `${INSTINCT_USER_PROMPT_PREFIX}\n\n### Context:\n{{{contextSnippets}}}\n\n### User Edits:\n\n{{{editDiffHistory}}}\n\n### User Excerpts:\n{{{currentFilePath}}}\n\n{{{currentFileContent}}}\`\`\`\n### Response:`,
  },
};

function templateRendererOfModel(
  modelName: NEXT_EDIT_MODELS,
): TemplateRenderer {
  let template = NEXT_EDIT_MODEL_TEMPLATES[modelName];
  if (!template) {
    throw new Error(`Model ${modelName} is not supported for next edit.`);
  }

  const compiledTemplate = Handlebars.compile(template.template);

  return (vars: TemplateVars): string => {
    return compiledTemplate(vars);
  };
}

export async function renderPrompt(
  helper: HelperVars,
  ctx: any,
): Promise<PromptMetadata> {
  let modelName = helper.modelName as NEXT_EDIT_MODELS;

  // Validate that the modelName is actually a supported model.
  if (!Object.keys(NEXT_EDIT_MODEL_TEMPLATES).includes(modelName)) {
    // Check if modelName includes any known model name as substring.
    const matchingModel = Object.keys(NEXT_EDIT_MODEL_TEMPLATES).find((key) =>
      modelName.includes(key),
    );

    if (matchingModel) {
      modelName = matchingModel as NEXT_EDIT_MODELS;
    } else {
      throw new Error(
        `${helper.modelName} is not yet supported for next edit.`,
      );
    }
  }

  const renderer = templateRendererOfModel(modelName);
  let userEdits = "";
  let editedCodeWithTokens = "";
  let tv: TemplateVars;

  switch (modelName) {
    case "mercury-coder-nextedit": {
      userEdits = ctx.editDiffHistory;

      // editedCodeWithTokens = insertTokens(
      //   helper.fileContents.split("\n"),
      //   helper.pos,
      //   MERCURY_CURSOR,
      // );

      const mercuryCtx: MercuryTemplateVars = {
        recentlyViewedCodeSnippets: recentlyViewedCodeSnippetsBlock(
          ctx.recentlyViewedCodeSnippets,
        ),
        currentFileContent: currentFileContentBlock(
          ctx.currentFileContent,
          ctx.editableRegionStartLine,
          ctx.editableRegionEndLine,
          helper.pos,
        ),
        editDiffHistory: editHistoryBlock(ctx.editDiffHistory),
        currentFilePath: ctx.currentFilePath,
      };

      tv = mercuryCtx;

      editedCodeWithTokens = mercuryCtx.currentFileContent;

      break;
    }
    case "instinct": {
      userEdits = ctx.editDiffHistory;

      // editedCodeWithTokens = insertTokens(
      //   helper.fileContents.split("\n"),
      //   helper.pos,
      //   INSTINCT_USER_CURSOR_IS_HERE_TOKEN,
      // );

      const instinctCtx: InstinctTemplateVars = {
        contextSnippets: contextSnippetsBlock(ctx.contextSnippets),
        currentFileContent: instinctCurrentFileContentBlock(
          ctx.currentFileContent,
          ctx.windowStart,
          ctx.windowEnd,
          ctx.editableRegionStartLine,
          ctx.editableRegionEndLine,
          helper.pos,
        ),
        editDiffHistory: instinctEditHistoryBlock(ctx.editDiffHistory),
        currentFilePath: ctx.currentFilePath,
        languageShorthand: ctx.languageShorthand,
      };

      tv = instinctCtx;

      editedCodeWithTokens = instinctCtx.currentFileContent;

      break;
    }
    default:
      tv = {};
      break;
  }

  return {
    prompt: {
      role: "user",
      content: renderer(tv),
    },
    userEdits,
    userExcerpts: editedCodeWithTokens,
  };
}

export function renderDefaultSystemPrompt(): SystemPrompt {
  return {
    role: "system",
    content: [
      /* Identity forming */
      "You are an expert polyglot developer who is overseeing a junior developer write code in some language.",
      "You are psychic as well, so you are an expert at reading minds just from what the junior has done.",
      "As an expert, you know what the next edit of the junior is going to be, and you want to suggest it to save both of your's time.",
      /* Action crash course */
      "An action is a change in code state that preserves the well-formedness of the code.",
      "Well-formedness means that given a cursor location, the local syntax tree that the cursor is in is syntactically correct, and the semantic correctness in the current cursor's character location - 1.",
      /* Input description */
      // 'You will receive a prompt that includes an instruction, and a JSON of following format: { "language": string; "originalCode": string; "newCode": string }.',
      // "language is the language the code is written in.",
      // "originalCode is the code state before the junior has taken some edit action.",
      // "editedCode is the code state after the junior has taken some edit action.",
      // "If we put originalCode and editedCode on a timeline, originalCode lives in the past, and editedCode is the current code state.",
      // "Measure the difference between the originalCode and editedCode inside the prompt, make your best understanding of what the junior wants to accomplish, and figure out what the junior will do next.",
      'You will receive a prompt that includes an instruction, and a JSON of following format: { "language": string; "rootPathSnippets": string; "importDefinitionSnippets": string; "ideSnippets": string; "recentlyEditedRangeSnippets": string; "diffSnippets": string; "clipboardSnippets": string; "recentlyVisitedRangesSnippets": string; }.',
      "rootPathSnippet is all the code that is part of an AST path from the root node to the node at the current cursor.",
      "recentlyEditedRange is the code that the junior has recently edited.",
      "Do not guess what previous edit the junior has taken right before the request -- this is already given to you.",
      "The next edit action can happen any location, so do not default to where the junior left off. A potential next edit action can happen before or after the junior edit.",
      "The junior might want to add new code, delete existing code, or replace different parts of code.",
      "The next edit action isn't strictly additive. It could be deleting existing code, or replacing parts of code.",
      /* Output description */
      'Reply with a JSON that has the following type: { "actionType": string; "newCode": string }.',
      /* NOTE: Jacob -- try toggling between these two descriptions of actionType.*/
      /* NOTE: Without reasoning, mercury tends to skew greatly towards not deleting things. */
      "actionType is a four-sentence description of the type of action the junior has taken and the reason why you determined that to be the case. Actually analyze the given edit.",
      // "actionType is the type of action the junior has taken.",
      "newCode is what the full code looks like after applying your nextEditContent.",
      // "Make sure that newCode does not have errors. You are given the language, and you should know what the typescript compiler will complain about.",
      "Given the above definition of an action, you should prioritize fixing the following:",
      "- Patterns and repetition in code.",
      "- Static errors that the compiler of the language may return.",
      "- The junior's code style.",
      "If the junior has deleted some code, there's a good chance that the next edit will also be deletions.",
      "If the junior has added some code, there's a good chance that the next edit will also be additions.",
      "If the junior has performed an action on some part of the code, and you see similar code remaining, there's a good chance that the next edit will also target these remaining similar code.",
      "Careful of language intricacies.",
      // "Always try deletion and replacements. Add code if there are no other valid or reasonable edit actions.",
      "Do not reply in markdown.",
      "Do not hallucinate.",
    ].join(" "),
  };
}

export function renderDefaultUserPrompt(
  // originalCode: string,
  // editedCode: string,
  snippets: SnippetPayload,
  helper: HelperVars,
): UserPrompt {
  const userEdit = {
    language: helper.lang,
    rootPathSnippets: snippets.rootPathSnippets,
    importDefinitionSnippets: snippets.importDefinitionSnippets,
    ideSnippets: snippets.ideSnippets,
    recentlyEditedRangeSnippets: snippets.recentlyEditedRangeSnippets,
    diffSnippets: snippets.diffSnippets,
    clipboardSnippets: snippets.clipboardSnippets,
    recentlyVisitedRangesSnippets: snippets.recentlyVisitedRangesSnippets,
  };

  return {
    role: "user",
    content: `Your junior made the following edit: ${JSON.stringify(userEdit)}. What is the most possible next edit your junior ${helper.lang.name} developer will make?`,
  };
}

function insertTokens(
  lines: string[],
  cursorPos: Position,
  cursorToken: string,
  editableRegionStart?: number,
  editableRegionEnd?: number,
) {
  const a = insertCursorToken(lines, cursorPos, cursorToken);
  const b = insertEditableRegionTokensWithStaticRange(
    a,
    cursorPos,
    editableRegionStart,
    editableRegionEnd,
  );
  return b.join("\n");
}
