// Fill in the middle prompts

import { CompletionOptions } from "../index.js";
import { shortestRelativePaths } from "../util/index.js";
import { AutocompleteSnippet } from "./ranking.js";

interface AutocompleteTemplate {
  template:
    | string
    | ((
        prefix: string,
        suffix: string,
        filepath: string,
        reponame: string,
        snippets: AutocompleteSnippet[],
      ) => string);
  completionOptions?: Partial<CompletionOptions>;
}

// https://huggingface.co/stabilityai/stable-code-3b
const stableCodeFimTemplate: AutocompleteTemplate = {
  template: "<fim_prefix>{{{prefix}}}<fim_suffix>{{{suffix}}}<fim_middle>",
  completionOptions: {
    stop: ["<fim_prefix>", "<fim_suffix>", "<fim_middle>", "<|endoftext|>"],
  },
};

const codestralFimTemplate: AutocompleteTemplate = {
  template: "<s>[SUFFIX]{{{suffix}}}[PREFIX]{{{prefix}}}",
  completionOptions: {
    stop: ["[PREFIX]", "[SUFFIX]"],
  },
};

const codestralMultifileFimTemplate: AutocompleteTemplate = {
  template: (
    prefix: string,
    suffix: string,
    filepath: string,
    reponame: string,
    snippets: AutocompleteSnippet[],
  ): string => {
    if (snippets.length === 0) {
      return `[SUFFIX]${suffix}[PREFIX]${prefix}`;
    }
    const relativePaths = shortestRelativePaths([
      ...snippets.map((snippet) => snippet.filepath),
      filepath,
    ]);
    const otherFiles = snippets
      .map((snippet, i) => `+++++ ${relativePaths[i]}\n${snippet.contents}`)
      .join("\n\n");
    const prompt = `[SUFFIX]${suffix}[PREFIX]${otherFiles}\n\n+++++ ${relativePaths[relativePaths.length - 1]}\n${prefix}`;
    return prompt;
  },
  completionOptions: {
    stop: ["[PREFIX]", "[SUFFIX]"],
  },
};

const codegemmaFimTemplate: AutocompleteTemplate = {
  template:
    "<|fim_prefix|>{{{prefix}}}<|fim_suffix|>{{{suffix}}}<|fim_middle|>",
  completionOptions: {
    stop: [
      "<|fim_prefix|>",
      "<|fim_suffix|>",
      "<|fim_middle|>",
      "<|file_separator|>",
      "<end_of_turn>",
      "<eos>",
    ],
  },
};

// https://arxiv.org/pdf/2402.19173.pdf section 5.1
const starcoder2FimTemplate: AutocompleteTemplate = {
  template: (
    prefix: string,
    suffix: string,
    filename: string,
    reponame: string,
    snippets: AutocompleteSnippet[],
  ): string => {
    const otherFiles =
      snippets.length === 0
        ? ""
        : `<file_sep>${snippets
            .map((snippet) => {
              return snippet.contents;
              // return `${getBasename(snippet.filepath)}\n${snippet.contents}`;
            })
            .join("<file_sep>")}<file_sep>`;

    const prompt = `${otherFiles}<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`;
    return prompt;
  },
  completionOptions: {
    stop: [
      "<fim_prefix>",
      "<fim_suffix>",
      "<fim_middle>",
      "<|endoftext|>",
      "<file_sep>",
    ],
  },
};

const codeLlamaFimTemplate: AutocompleteTemplate = {
  template: "<PRE> {{{prefix}}} <SUF>{{{suffix}}} <MID>",
  completionOptions: { stop: ["<PRE>", "<SUF>", "<MID>", "<EOT>"] },
};

// https://huggingface.co/deepseek-ai/deepseek-coder-1.3b-base
const deepseekFimTemplate: AutocompleteTemplate = {
  template:
    "<｜fim▁begin｜>{{{prefix}}}<｜fim▁hole｜>{{{suffix}}}<｜fim▁end｜>",
  completionOptions: {
    stop: [
      "<｜fim▁begin｜>",
      "<｜fim▁hole｜>",
      "<｜fim▁end｜>",
      "//",
      "<｜end▁of▁sentence｜>",
    ],
  },
};

const deepseekFimTemplateWrongPipeChar: AutocompleteTemplate = {
  template: "<|fim▁begin|>{{{prefix}}}<|fim▁hole|>{{{suffix}}}<|fim▁end|>",
  completionOptions: { stop: ["<|fim▁begin|>", "<|fim▁hole|>", "<|fim▁end|>"] },
};

const gptAutocompleteTemplate: AutocompleteTemplate = {
  template: `\`\`\`
{{{prefix}}}[BLANK]{{{suffix}}}
\`\`\`

Fill in the blank to complete the code block. Your response should include only the code to replace [BLANK], without surrounding backticks.`,
  completionOptions: { stop: ["\n"] },
};

const holeFillerTemplate: AutocompleteTemplate = {
  template: (
    prefix: string,
    suffix: string,
    filename: string,
    reponame: string,
    snippets: AutocompleteSnippet[],
  ) => {
    // From https://github.com/VictorTaelin/AI-scripts
    const SYSTEM_MSG = `You are a HOLE FILLER. You are provided with a file containing holes, formatted as '{{HOLE_NAME}}'. Your TASK is to complete with a string to replace this hole with, inside a <COMPLETION/> XML tag, including context-aware indentation, if needed.  All completions MUST be truthful, accurate, well-written and correct.

## EXAMPLE QUERY:

<QUERY>
function sum_evens(lim) {
  var sum = 0;
  for (var i = 0; i < lim; ++i) {
    {{FILL_HERE}}
  }
  return sum;
}
</QUERY>

TASK: Fill the {{FILL_HERE}} hole.

## CORRECT COMPLETION

<COMPLETION>if (i % 2 === 0) {
      sum += i;
    }</COMPLETION>

## EXAMPLE QUERY:

<QUERY>
def sum_list(lst):
  total = 0
  for x in lst:
  {{FILL_HERE}}
  return total

print sum_list([1, 2, 3])
</QUERY>

## CORRECT COMPLETION:

<COMPLETION>  total += x</COMPLETION>

## EXAMPLE QUERY:

<QUERY>
// data Tree a = Node (Tree a) (Tree a) | Leaf a

// sum :: Tree Int -> Int
// sum (Node lft rgt) = sum lft + sum rgt
// sum (Leaf val)     = val

// convert to TypeScript:
{{FILL_HERE}}
</QUERY>

## CORRECT COMPLETION:

<COMPLETION>type Tree<T>
  = {$:"Node", lft: Tree<T>, rgt: Tree<T>}
  | {$:"Leaf", val: T};

function sum(tree: Tree<number>): number {
  switch (tree.$) {
    case "Node":
      return sum(tree.lft) + sum(tree.rgt);
    case "Leaf":
      return tree.val;
  }
}</COMPLETION>

## EXAMPLE QUERY:

The 4th {{FILL_HERE}} is Jupiter.

## CORRECT COMPLETION:

<COMPLETION>the 4th planet after Mars</COMPLETION>

## EXAMPLE QUERY:

function hypothenuse(a, b) {
  return Math.sqrt({{FILL_HERE}}b ** 2);
}

## CORRECT COMPLETION:

<COMPLETION>a ** 2 + </COMPLETION>`;

    const fullPrompt =
      SYSTEM_MSG +
      `\n\n<QUERY>\n${prefix}{{FILL_HERE}}${suffix}\n</QUERY>\nTASK: Fill the {{FILL_HERE}} hole. Answer only with the CORRECT completion, and NOTHING ELSE. Do it now.\n<COMPLETION>`;
    return fullPrompt;
  },
  completionOptions: {
    stop: ["</COMPLETION>"],
  },
};

export function getTemplateForModel(model: string): AutocompleteTemplate {
  const lowerCaseModel = model.toLowerCase();

  // if (lowerCaseModel.includes("starcoder2")) {
  //   return starcoder2FimTemplate;
  // }

  if (
    lowerCaseModel.includes("starcoder") ||
    lowerCaseModel.includes("star-coder") ||
    lowerCaseModel.includes("starchat") ||
    lowerCaseModel.includes("octocoder") ||
    lowerCaseModel.includes("stable") ||
    lowerCaseModel.includes("codeqwen")
  ) {
    return stableCodeFimTemplate;
  }

  if (lowerCaseModel.includes("codestral")) {
    return codestralMultifileFimTemplate;
  }

  if (lowerCaseModel.includes("codegemma")) {
    return codegemmaFimTemplate;
  }

  if (lowerCaseModel.includes("codellama")) {
    return codeLlamaFimTemplate;
  }

  if (lowerCaseModel.includes("deepseek")) {
    return deepseekFimTemplate;
  }

  if (
    lowerCaseModel.includes("gpt") ||
    lowerCaseModel.includes("davinci-002") ||
    lowerCaseModel.includes("claude")
  ) {
    return holeFillerTemplate;
  }

  return stableCodeFimTemplate;
}
