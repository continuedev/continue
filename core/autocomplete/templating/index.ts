import Handlebars from "handlebars";

import { CompletionOptions } from "../..";
import { getBasename, getLastNPathParts } from "../../util";
import { AutocompleteLanguageInfo } from "../constants/AutocompleteLanguageInfo";
import { HelperVars } from "../util/HelperVars";

import {
  AutocompleteTemplate,
  getTemplateForModel,
} from "./AutocompleteTemplate";
import { getStopTokens } from "./getStopTokens";
import { countTokens } from "../../llm/countTokens";
import { AutocompleteSnippetDeprecated } from "../types";
import {
  AutocompleteCodeSnippet,
  AutocompleteSnippet,
} from "../snippets/types";

const addCommentMarks = (text: string, language: AutocompleteLanguageInfo) => {
  const comment = language.singleLineComment;
  const lines = [
    ...text
      .trim()
      .split("\n")
      .map((line) => `${comment} ${line}`),
  ];
  return lines.join("\n");
};

export function formatExternalSnippet(
  filepath: string,
  snippet: string,
  language: AutocompleteLanguageInfo,
) {
  const filePathString = `Path: ${getBasename(filepath)}\n`;
  return addCommentMarks(`${filePathString}${snippet}`, language);
}

function getContextComments(
  snippets: AutocompleteCodeSnippet[],
  lang: AutocompleteLanguageInfo,
  filepath: string,
) {
  if (snippets.length === 0) {
    return "";
  }

  const headerSnipper = `\n\n${lang.singleLineComment} Related code:\n`;
  const fileNameSnippet = `\n\n${lang.singleLineComment} ${getLastNPathParts(filepath, 2)}\n\n`;

  const formattedSnippets =
    headerSnipper +
    snippets
      .map((snippet) =>
        formatExternalSnippet(snippet.filepath, snippet.content, lang),
      )
      .join("\n") +
    fileNameSnippet;

  return formattedSnippets;
}

function getTemplate(helper: HelperVars): AutocompleteTemplate {
  if (helper.options.template) {
    return {
      template: helper.options.template,
      completionOptions: {},
      compilePrefixSuffix: undefined,
    };
  }
  return getTemplateForModel(helper.modelName);
}

function renderStringTemplate(
  template: string,
  prefix: string,
  suffix: string,
  lang: AutocompleteLanguageInfo,
  filepath: string,
  reponame: string,
) {
  const filename = getBasename(filepath);
  const compiledTemplate = Handlebars.compile(template);

  return compiledTemplate({
    prefix,
    suffix,
    filename,
    reponame,
    language: lang.name,
  });
}

const formatDiff = (helper: HelperVars, diff?: string) => {
  if (!diff) return "";

  const tokenCount = countTokens(diff, helper.modelName);

  if (tokenCount > helper.maxDiffTokens) {
    return "";
  }

  return `${diff}\n\n`;
};

const MAX_CLIPBOARD_AGE = 5 * 60 * 1000;

const formatClipboardContent = (
  helper: HelperVars,
  { text, copiedAt }: { text: string; copiedAt: string },
) => {
  const currDate = new Date();

  const isTooOld =
    currDate.getTime() - new Date(copiedAt).getTime() > MAX_CLIPBOARD_AGE;

  if (isTooOld) {
    return "";
  }

  const tokenCount = countTokens(text, helper.modelName);
  const isTooLong = tokenCount > helper.maxClipboardTokens;

  if (isTooLong) {
    return "";
  }

  const isEmpty = text.trim() === "";
  if (isEmpty) {
    return "";
  }

  return (
    addCommentMarks(
      `Recently copied by user:${text.includes("\n") ? "\n" : ""} ${text}`,
      helper.lang,
    ) + "\n"
  );
};

export function renderPrompt({
  snippets,
  workspaceDirs,
  helper,
  diff,
  clipboardContent,
}: {
  snippets: AutocompleteCodeSnippet[];
  workspaceDirs: string[];
  helper: HelperVars;
  diff?: string;
  clipboardContent: {
    text: string;
    copiedAt: string;
  };
}): {
  prompt: string;
  prefix: string;
  suffix: string;
  completionOptions: Partial<CompletionOptions> | undefined;
} {
  // If prefix is manually passed
  let prefix = helper.input.manuallyPassPrefix || helper.prunedPrefix;
  let suffix = helper.input.manuallyPassPrefix ? "" : helper.prunedSuffix;

  const reponame = getBasename(workspaceDirs[0] ?? "myproject");

  const { template, compilePrefixSuffix, completionOptions } =
    getTemplate(helper);

  // Some models have prompts that need two passes. This lets us pass the compiled prefix/suffix
  // into either the 2nd template to generate a raw string, or to pass prefix, suffix to a FIM endpoint
  if (compilePrefixSuffix) {
    [prefix, suffix] = compilePrefixSuffix(
      prefix,
      suffix,
      helper.filepath,
      reponame,
      snippets,
    );
  } else {
    const contextComments = getContextComments(
      snippets,
      helper.lang,
      helper.filepath,
    );
    const formattedDiff = formatDiff(helper, diff);
    const formattedClipboard = formatClipboardContent(helper, clipboardContent);

    prefix = [formattedClipboard, formattedDiff, contextComments, prefix].join(
      "",
    );
  }

  const prompt =
    // Templates can be passed as a Handlebars template string or a function
    typeof template === "string"
      ? renderStringTemplate(
          template,
          prefix,
          suffix,
          helper.lang,
          helper.filepath,
          reponame,
        )
      : template(
          prefix,
          suffix,
          helper.filepath,
          reponame,
          helper.lang.name,
          snippets,
        );

  const stopTokens = getStopTokens(
    completionOptions,
    helper.lang,
    helper.modelName,
  );

  return {
    prompt,
    prefix,
    suffix,
    completionOptions: {
      ...completionOptions,
      stop: stopTokens,
    },
  };
}
