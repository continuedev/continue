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
  completionOptions: { stop: ["<PRE>", "<SUF>", "<MID>"] },
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

export function getTemplateForModel(model: string): AutocompleteTemplate {
  if (
    model.includes("starcoder") ||
    model.includes("star-coder") ||
    model.includes("stable")
  ) {
    return stableCodeFimTemplate;
  }

  if (model.includes("codellama")) {
    return codeLlamaFimTemplate;
  }

  if (model.includes("deepseek")) {
    return deepseekFimTemplate;
  }

  return stableCodeFimTemplate;
}
