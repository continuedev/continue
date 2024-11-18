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
  prefix: string,
  suffix: string,
) {
  const formattedSnippets = snippets
    .map((snippet) =>
      formatExternalSnippet(snippet.filepath, snippet.contents, lang),
    )
    .join("\n");
  if (formattedSnippets.length > 0) {
    return `${formattedSnippets}\n\n`;
  }

  const isEmptyFile = prefix.trim().length === 0 && suffix.trim().length === 0;
  if (isEmptyFile) {
    // Include the file name as a comment
    prefix = `${lang.singleLineComment} ${getLastNPathParts(filepath, 2)}\n`;
  }

  return "";
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

export function renderPrompt(
  snippets: AutocompleteSnippet[],
  workspaceDirs: string[],
  helper: HelperVars,
): {
  prompt: string;
  prefix: string;
  suffix: string;
  completionOptions: Partial<CompletionOptions> | undefined;
} {
  debugger;
  // If prefix is manually passed
  let prefix = helper.prunedPrefix;
  let suffix = helper.prunedSuffix;

  if (helper.input.manuallyPassPrefix) {
    prefix = helper.input.manuallyPassPrefix;
    suffix = "";
  }

  let prompt: string;
  const reponame = getBasename(workspaceDirs[0] ?? "myproject");

  let { template, compilePrefixSuffix, completionOptions } =
    getTemplate(helper);

  const contextComments = getContextComments(
    snippets,
    helper.lang,
    helper.filepath,
    prefix,
    suffix,
  );

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
    prefix = `${contextComments}${prefix}`;
  }

  prompt =
    // Templates can be passed as a Handlebars template string or a function
    typeof template === "string"
      ? renderStringTemplate(
          template,
          `${contextComments}${prefix}`,
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

  completionOptions = {
    ...completionOptions,
    stop: stopTokens,
  };

  return { prompt, prefix, suffix, completionOptions };
}
