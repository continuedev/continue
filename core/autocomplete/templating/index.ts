import { CompletionOptions } from "../..";
import { getBasename, getLastNPathParts } from "../../util";
import { shouldCompleteMultiline } from "../classification/shouldCompleteMultiline";
import { AutocompleteLanguageInfo } from "../constants/AutocompleteLanguageInfo";
import { AutocompleteSnippet } from "../context/ranking";
import { HelperVars } from "../util/HelperVars";
import { getTemplateForModel } from "./AutocompleteTemplate";
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
function renderStringTemplate(
  template: string,
  prefix: string,
  suffix: string,
  snippets: AutocompleteSnippet[],
  lang: AutocompleteLanguageInfo,
  filepath: string,
  reponame: string,
) {
  const filename = getBasename(filepath);
  const compiledTemplate = Handlebars.compile(template);

  // Format snippets as comments and prepend to prefix
  const formattedSnippets = snippets
    .map((snippet) =>
      formatExternalSnippet(snippet.filepath, snippet.contents, lang),
    )
    .join("\n");
  if (formattedSnippets.length > 0) {
    prefix = `${formattedSnippets}\n\n${prefix}`;
  } else if (prefix.trim().length === 0 && suffix.trim().length === 0) {
    // If it's an empty file, include the file name as a comment
    prefix = `${lang.singleLineComment} ${getLastNPathParts(
      filepath,
      2,
    )}\n${prefix}`;
  }

  const prompt = compiledTemplate({
    prefix,
    suffix,
    filename,
    reponame,
    language: lang.name,
  });
  return prompt;
}

export function renderPrompt(
  prefix: string,
  suffix: string,
  snippets: AutocompleteSnippet[],
  workspaceDirs: string[],
  helper: HelperVars,
): [string, Partial<CompletionOptions> | undefined, boolean] {
  let {
    template,
    completionOptions,
    compilePrefixSuffix = undefined,
  } = helper.options.template
    ? { template: helper.options.template, completionOptions: {} }
    : getTemplateForModel(helper.modelName);

  let prompt: string;
  const reponame = getBasename(workspaceDirs[0] ?? "myproject");

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
  }

  // Templates can be passed as a Handlebars template string or a function
  if (typeof template === "string") {
    prompt = renderStringTemplate(
      template,
      prefix,
      suffix,
      snippets,
      helper.lang,
      helper.filepath,
      reponame,
    );
  } else {
    prompt = template(
      prefix,
      suffix,
      helper.filepath,
      reponame,
      helper.lang.name,
      snippets,
    );
  }

  const multiline =
    !helper.options.transform ||
    shouldCompleteMultiline(helper, prefix, suffix);

  const stopTokens = getStopTokens(
    completionOptions,
    helper.lang,
    helper.modelName,
  );

  completionOptions = {
    ...completionOptions,
    stop: stopTokens,
  };

  return [prompt, completionOptions, multiline];
}
