// Fill in the middle prompts

import { CompletionOptions } from "..";

interface AutocompleteTemplate {
  template: string | ((prefix: string, suffix: string) => string);
  completionOptions?: Partial<CompletionOptions>;
}

// https://huggingface.co/stabilityai/stable-code-3b
const stableCodeFimTemplate: AutocompleteTemplate = {
  template: "<fim_prefix>{{{prefix}}}<fim_suffix>{{{suffix}}}<fim_middle>",
  completionOptions: {
    stop: ["<fim_prefix>", "<fim_suffix>", "<fim_middle>", "<|endoftext|>"],
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
  template: `Your task is to complete the line at the end of this code block:
\`\`\`
{{{prefix}}}
\`\`\`

The last line is incomplete, and you should provide the rest of that line. If the line is already complete, just return a new line. Otherwise, DO NOT provide explanation, a code block, or extra whitespace, just the code that should be added to the last line to complete it:`,
  completionOptions: { stop: ["\n"] },
};

export function getTemplateForModel(model: string): AutocompleteTemplate {
  const lowerCaseModel = model.toLowerCase();
  if (
    lowerCaseModel.includes("starcoder") ||
    lowerCaseModel.includes("star-coder") ||
    lowerCaseModel.includes("starchat") ||
    lowerCaseModel.includes("stable")
  ) {
    return stableCodeFimTemplate;
  }

  if (lowerCaseModel.includes("codellama")) {
    return codeLlamaFimTemplate;
  }

  if (lowerCaseModel.includes("deepseek")) {
    return deepseekFimTemplate;
  }

  if (lowerCaseModel.includes("gpt")) {
    return gptAutocompleteTemplate;
  }

  return stableCodeFimTemplate;
}
