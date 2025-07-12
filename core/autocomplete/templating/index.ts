import Handlebars from "handlebars";

import { CompletionOptions } from "../..";
import { AutocompleteLanguageInfo } from "../constants/AutocompleteLanguageInfo";
import { HelperVars } from "../util/HelperVars";

import { ILLM } from "../../index.js";
import { DEFAULT_MAX_TOKENS } from "../../llm/constants.js";
import {
  countTokens,
  getTokenCountingBufferSafety,
  pruneLinesFromBottom,
  pruneLinesFromTop,
} from "../../llm/countTokens";
import { getUriPathBasename } from "../../util/uri";
import { SnippetPayload } from "../snippets";
import { AutocompleteSnippet } from "../snippets/types";
import {
  AutocompleteTemplate,
  getTemplateForModel,
} from "./AutocompleteTemplate";
import { getSnippets } from "./filtering";
import { formatSnippets } from "./formatting";
import { getStopTokens } from "./getStopTokens";

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
  const filename = getUriPathBasename(filepath);
  const compiledTemplate = Handlebars.compile(template);

  return compiledTemplate({
    prefix,
    suffix,
    filename,
    reponame,
    language: lang.name,
  });
}

/** Consolidates shared setup between renderPrompt and renderPromptWithTokenLimit. */
function preparePromptContext({
  snippetPayload,
  workspaceDirs,
  helper,
}: {
  snippetPayload: SnippetPayload;
  workspaceDirs: string[];
  helper: HelperVars;
}): {
  prefix: string;
  suffix: string;
  reponame: string;
  template: AutocompleteTemplate["template"];
  compilePrefixSuffix: AutocompleteTemplate["compilePrefixSuffix"] | undefined;
  completionOptions: Partial<CompletionOptions> | undefined;
  snippets: AutocompleteSnippet[];
} {
  // Determine base prefix/suffix, accounting for any manually supplied prefix.
  let prefix = helper.input.manuallyPassPrefix || helper.prunedPrefix;
  let suffix = helper.input.manuallyPassPrefix ? "" : helper.prunedSuffix;
  if (suffix === "") {
    suffix = "\n";
  }

  const reponame = getUriPathBasename(workspaceDirs[0] ?? "myproject");

  const { template, compilePrefixSuffix, completionOptions } =
    getTemplate(helper);

  const snippets = getSnippets(helper, snippetPayload);

  return {
    prefix,
    suffix,
    reponame,
    template,
    compilePrefixSuffix,
    completionOptions,
    snippets,
  };
}

export function renderPrompt({
  snippetPayload,
  workspaceDirs,
  helper,
}: {
  snippetPayload: SnippetPayload;
  workspaceDirs: string[];
  helper: HelperVars;
}): {
  prompt: string;
  prefix: string;
  suffix: string;
  completionOptions: Partial<CompletionOptions> | undefined;
} {
  const {
    prefix,
    suffix,
    reponame,
    template,
    compilePrefixSuffix,
    completionOptions,
    snippets,
  } = preparePromptContext({ snippetPayload, workspaceDirs, helper });

  // Delegate prompt construction to buildPrompt to avoid duplication.
  const {
    prompt,
    prefix: compiledPrefix,
    suffix: compiledSuffix,
  } = buildPrompt(
    template,
    compilePrefixSuffix,
    prefix,
    suffix,
    helper,
    snippets,
    workspaceDirs,
    reponame,
  );

  const stopTokens = getStopTokens(
    completionOptions,
    helper.lang,
    helper.modelName,
  );

  return {
    prompt,
    prefix: compiledPrefix,
    suffix: compiledSuffix,
    completionOptions: {
      ...completionOptions,
      stop: stopTokens,
    },
  };
}

/** Builds the final prompt by applying prefix/suffix compilation or snippet formatting, then rendering the template. */
function buildPrompt(
  template: AutocompleteTemplate["template"],
  compilePrefixSuffix: AutocompleteTemplate["compilePrefixSuffix"] | undefined,
  prefix: string,
  suffix: string,
  helper: HelperVars,
  snippets: AutocompleteSnippet[],
  workspaceDirs: string[],
  reponame: string,
): { prompt: string; prefix: string; suffix: string } {
  if (compilePrefixSuffix) {
    [prefix, suffix] = compilePrefixSuffix(
      prefix,
      suffix,
      helper.filepath,
      reponame,
      snippets,
      helper.workspaceUris,
    );
  } else {
    const formatted = formatSnippets(helper, snippets, workspaceDirs);
    prefix = [formatted, prefix].join("\n");
  }
  const prompt =
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
          helper.workspaceUris,
        );
  return { prompt, prefix, suffix };
}

function pruneLength(llm: ILLM, prompt: string): number {
  const contextLength = llm.contextLength;
  const reservedTokens = llm.completionOptions.maxTokens ?? DEFAULT_MAX_TOKENS;
  const safetyBuffer = getTokenCountingBufferSafety(contextLength);
  const maxAllowedPromptTokens = contextLength - reservedTokens - safetyBuffer;
  const promptTokenCount = countTokens(prompt, llm.model);
  return promptTokenCount - maxAllowedPromptTokens;
}

export function renderPromptWithTokenLimit({
  snippetPayload,
  workspaceDirs,
  helper,
  llm,
}: {
  snippetPayload: SnippetPayload;
  workspaceDirs: string[];
  helper: HelperVars;
  llm: ILLM | undefined;
}): {
  prompt: string;
  prefix: string;
  suffix: string;
  completionOptions: Partial<CompletionOptions> | undefined;
} {
  const {
    prefix: initialPrefix,
    suffix: initialSuffix,
    reponame,
    template,
    compilePrefixSuffix,
    completionOptions,
    snippets,
  } = preparePromptContext({ snippetPayload, workspaceDirs, helper });

  // We'll mutate prefix/suffix during pruning, so copy them.
  let prefix = initialPrefix;
  let suffix = initialSuffix;

  let {
    prompt,
    prefix: compiledPrefix,
    suffix: compiledSuffix,
  } = buildPrompt(
    template,
    compilePrefixSuffix,
    prefix,
    suffix,
    helper,
    snippets,
    workspaceDirs,
    reponame,
  );

  // Truncate prefix and suffix if prompt tokens exceed maxAllowedPromptTokens
  if (llm) {
    const prune = pruneLength(llm, prompt);
    if (prune > 0) {
      const tokensToDrop = prune;
      const prefixTokenCount = countTokens(prefix, helper.modelName);
      const suffixTokenCount = countTokens(suffix, helper.modelName);
      const totalContextTokens = prefixTokenCount + suffixTokenCount;
      if (totalContextTokens > 0) {
        const dropPrefix = Math.ceil(
          tokensToDrop * (prefixTokenCount / totalContextTokens),
        );
        const dropSuffix = Math.ceil(tokensToDrop - dropPrefix);
        const allowedPrefixTokens = Math.max(0, prefixTokenCount - dropPrefix);
        const allowedSuffixTokens = Math.max(0, suffixTokenCount - dropSuffix);
        prefix = pruneLinesFromTop(
          prefix,
          allowedPrefixTokens,
          helper.modelName,
        );
        suffix = pruneLinesFromBottom(
          suffix,
          allowedSuffixTokens,
          helper.modelName,
        );
      }
      ({
        prompt,
        prefix: compiledPrefix,
        suffix: compiledSuffix,
      } = buildPrompt(
        template,
        compilePrefixSuffix,
        prefix,
        suffix,
        helper,
        snippets,
        workspaceDirs,
        reponame,
      ));
    }
  }

  const stopTokens = getStopTokens(
    completionOptions,
    helper.lang,
    helper.modelName,
  );

  return {
    prompt,
    prefix: compiledPrefix,
    suffix: compiledSuffix,
    completionOptions: {
      ...completionOptions,
      stop: stopTokens,
    },
  };
}
