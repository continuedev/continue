import Handlebars from "handlebars";
import { Position } from "../..";
import { SnippetPayload } from "../../autocomplete/snippets";
import { HelperVars } from "../../autocomplete/util/HelperVars";
import {
  EDITABLE_REGION_END_TOKEN,
  EDITABLE_REGION_START_TOKEN,
  NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
  NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
  USER_CURSOR_IS_HERE_TOKEN,
} from "../constants";
import {
  NextEditTemplate,
  PromptMetadata,
  SystemPrompt,
  TemplateVars,
  UserPrompt,
} from "../types";

type TemplateRenderer = (vars: TemplateVars) => string;

type NextEditModelName = "mercury-coder-nextedit" | "this field is not used";

const NEXT_EDIT_MODEL_TEMPLATES: Record<NextEditModelName, NextEditTemplate> = {
  "mercury-coder-nextedit": {
    template:
      "### User Edits:\n\n{{{userEdits}}}\n\n### User Excerpts:\n\n```{{{languageShorthand}}}\n{{{userExcerpts}}}```",
  },
  "this field is not used": {
    template: "NEXT_EDIT",
  },
};

function templateRendererOfModel(
  modelName: NextEditModelName,
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

export function renderPrompt(
  helper: HelperVars,
  userEdits: string,
): PromptMetadata {
  let modelName = helper.modelName as NextEditModelName;

  if (modelName === "this field is not used") {
    return {
      prompt: {
        role: "user",
        content: "NEXT_EDIT",
      },
      userEdits,
      userExcerpts: helper.fileContents,
    };
  }

  // Validate that the modelName is actually a supported model.
  if (!Object.keys(NEXT_EDIT_MODEL_TEMPLATES).includes(modelName)) {
    // Check if modelName includes any known model name as substring.
    const matchingModel = Object.keys(NEXT_EDIT_MODEL_TEMPLATES).find((key) =>
      modelName.includes(key),
    );

    if (matchingModel) {
      modelName = matchingModel as NextEditModelName;
    } else {
      throw new Error(
        `${helper.modelName} is not yet supported for next edit.`,
      );
    }
  }

  const renderer = templateRendererOfModel(modelName);
  const editedCodeWithTokens = insertTokens(
    helper.fileContents.split("\n"),
    helper.pos,
  );

  const tv: TemplateVars = {
    userEdits,
    languageShorthand: helper.lang.name,
    userExcerpts: editedCodeWithTokens,
  };

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

// export async function renderFineTunedUserPrompt(
//   snippets: SnippetPayload,
//   ide: IDE,
//   helper: HelperVars,
// ): Promise<UserPrompt> {
//   const ideInfo = await ide.getIdeInfo();
//   switch (ideInfo.ideType) {
//     case "vscode":
//       const editedCodeWithPins = insertTokens(
//         helper.fileContents.split("\n"),
//         helper.pos,
//       );

//       return {
//         role: "user",
//         content: renderStringTemplate(
//           mercuryCoderTemplate,
//           snippets.diffSnippets.join("\n"),
//           helper.lang.name,
//           editedCodeWithPins,
//         ),
//       };

//     case "jetbrains":
//       return {
//         role: "user",
//         content: "",
//       };
//   }
// }

// export async function renderDefaultBasicUserPrompt(
//   snippets: SnippetPayload,
//   ide: IDE,
//   helper: HelperVars,
// ): Promise<UserPrompt> {
//   const ideInfo = await ide.getIdeInfo();
//   switch (ideInfo.ideType) {
//     case "vscode":
//       const editedCodeWithPins = insertTokens(
//         helper.fileContents.split("\n"),
//         helper.pos,
//       );

//       return {
//         role: "user",
//         content: renderStringTemplate(
//           mercuryCoderTemplate,
//           JSON.stringify(snippets),
//           helper.lang.name,
//           editedCodeWithPins,
//         ),
//       };

//     case "jetbrains":
//       return {
//         role: "user",
//         content: "",
//       };
//   }
// }

// export async function renderFineTunedBasicUserPrompt(
//   snippets: SnippetPayload,
//   ide: IDE,
//   helper: HelperVars,
//   diffContext: string,
// ): Promise<UserPrompt> {
//   const ideInfo = await ide.getIdeInfo();
//   switch (ideInfo.ideType) {
//     case "vscode":
//       const lines = helper.fileContents.split("\n");
//       const editedCodeWithPins = insertTokens(lines, helper.pos);

//       return {
//         role: "user",
//         content: renderStringTemplate(
//           mercuryCoderTemplate,
//           diffContext,
//           helper.lang.name,
//           editedCodeWithPins,
//         ),
//       };

//     case "jetbrains":
//       return {
//         role: "user",
//         content: "",
//       };
//   }
// }

function insertTokens(lines: string[], cursorPos: Position) {
  const a = insertCursorToken(lines, cursorPos);
  const b = insertEditableRegionTokensWithStaticRange(a, cursorPos);
  return b.join("\n");
}

function insertCursorToken(lines: string[], cursorPos: Position) {
  if (cursorPos.line < 0 || cursorPos.line >= lines.length) {
    return lines;
  }

  // Ensure character position is within bounds or at the end of the line.
  const lineLength = lines[cursorPos.line].length;
  const charPos = Math.min(Math.max(0, cursorPos.character), lineLength);

  lines[cursorPos.line] =
    lines[cursorPos.line].slice(0, charPos) +
    USER_CURSOR_IS_HERE_TOKEN +
    lines[cursorPos.line].slice(charPos);

  return lines;
}

function insertEditableRegionTokensWithStaticRange(
  lines: string[],
  cursorPos: Position,
) {
  if (cursorPos.line < 0 || cursorPos.line >= lines.length) {
    return lines;
  }

  // Ensure editable regions are within bounds.
  const editableRegionStart = Math.max(
    cursorPos.line - NEXT_EDIT_EDITABLE_REGION_TOP_MARGIN,
    0,
  );
  const editableRegionEnd = Math.min(
    cursorPos.line + NEXT_EDIT_EDITABLE_REGION_BOTTOM_MARGIN,
    lines.length - 1, // Line numbers should be zero-indexed.
  );

  const instrumentedLines = [
    ...lines.slice(0, editableRegionStart),
    EDITABLE_REGION_START_TOKEN,
    ...lines.slice(editableRegionStart, editableRegionEnd + 1),
    EDITABLE_REGION_END_TOKEN,
    ...lines.slice(editableRegionEnd + 1),
  ];

  return instrumentedLines;
}

function insertEditableRegionTokensWithAst(
  lines: string[],
  cursorPos: Position,
) {
  if (cursorPos.line < 0 || cursorPos.line >= lines.length) {
    return lines;
  }

  // Ensure character position is within bounds or at the end of the line.
  const lineLength = lines[cursorPos.line].length;
  const charPos = Math.min(Math.max(0, cursorPos.character), lineLength);

  (lines[cursorPos.line] =
    lines[cursorPos.line].slice(0, charPos) + USER_CURSOR_IS_HERE_TOKEN),
    lines[cursorPos.line].slice(charPos);

  return lines;
}
