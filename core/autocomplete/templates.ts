// Fill in the middle prompts

import { CompletionOptions } from "..";
import { AutocompleteSnippet } from "./ranking";

interface AutocompleteTemplate {
  template:
    | string
    | ((
        prefix: string,
        suffix: string,
        filename: string,
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

const codegemmaFimTemplate: AutocompleteTemplate = {
  template: "<|fim_prefix|>{{{prefix}}}<|fim_suffix|>{{{suffix}}}<|fim_middle|>",
  completionOptions: {
    stop: ["<|fim_prefix|>", "<|fim_suffix|>", "<|fim_middle|>", "<|file_separator|>", "<end_of_turn>", "<eos>"],
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
        : "<file_sep>" +
          snippets
            .map((snippet) => {
              return snippet.contents;
              // return `${getBasename(snippet.filepath)}\n${snippet.contents}`;
            })
            .join("<file_sep>") +
          "<file_sep>";

    let prompt = `${otherFiles}<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`;
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
    stop: ["<｜fim▁begin｜>", "<｜fim▁hole｜>", "<｜fim▁end｜>", "//"],
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
    lowerCaseModel.includes("stable")
  ) {
    return stableCodeFimTemplate;
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
    return gptAutocompleteTemplate;
  }

  return stableCodeFimTemplate;
}
