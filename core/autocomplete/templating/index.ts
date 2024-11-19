import Handlebars from "handlebars";

import { CompletionOptions } from "../..";
import { getBasename, getLastNPathParts } from "../../util";
import { AutocompleteLanguageInfo } from "../constants/AutocompleteLanguageInfo";
import { AutocompleteSnippet } from "../context/ranking";
import { HelperVars } from "../util/HelperVars";

import {
  AutocompleteTemplate,
  getTemplateForModel,
} from "./AutocompleteTemplate";
import { getStopTokens } from "./getStopTokens";
import { countTokens } from "../../llm/countTokens";

export function formatExternalSnippet(
  filepath: string,
  snippet: string,
  language: AutocompleteLanguageInfo,
) {
  const comment = language.singleLineComment;
  const lines = [
    `${comment} Path: ${getBasename(filepath)}`,
    ...snippet
      .trim()
      .split("\n")
      .map((line) => `${comment} ${line}`),
    comment,
  ];
  return lines.join("\n");
}

function getContextComments(
  snippets: AutocompleteSnippet[],
  lang: AutocompleteLanguageInfo,
  filepath: string,
) {
  const fileNameSnippet = `\n\n${lang.singleLineComment} ${getLastNPathParts(filepath, 2)}\n\n`;

  const formattedSnippets =
    snippets
      .map((snippet) =>
        formatExternalSnippet(snippet.filepath, snippet.contents, lang),
      )
      .join("\n") + fileNameSnippet;

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

export function renderPrompt({
  snippets,
  workspaceDirs,
  helper,
  diff,
}: {
  snippets: AutocompleteSnippet[];
  workspaceDirs: string[];
  helper: HelperVars;
  diff?: string;
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

    prefix = `${formattedDiff}${contextComments}${prefix}`;
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
