import { ModelProvider, TemplateType } from "..";
import {
  anthropicTemplateMessages,
  chatmlTemplateMessages,
  codeLlama70bTemplateMessages,
  deepseekTemplateMessages,
  gemmaTemplateMessage,
  llama2TemplateMessages,
  llavaTemplateMessages,
  neuralChatTemplateMessages,
  openchatTemplateMessages,
  phi2TemplateMessages,
  phindTemplateMessages,
  templateAlpacaMessages,
  xWinCoderTemplateMessages,
  zephyrTemplateMessages,
} from "./templates/chat";
import {
  alpacaEditPrompt,
  claudeEditPrompt,
  codeLlama70bEditPrompt,
  deepseekEditPrompt,
  gemmaEditPrompt,
  gptEditPrompt,
  mistralEditPrompt,
  neuralChatEditPrompt,
  openchatEditPrompt,
  osModelsEditPrompt,
  phindEditPrompt,
  simplifiedEditPrompt,
  xWinCoderEditPrompt,
  zephyrEditPrompt,
} from "./templates/edit";

const PROVIDER_HANDLES_TEMPLATING: ModelProvider[] = [
  "lmstudio",
  "openai",
  "ollama",
  "together",
  "anthropic",
  "bedrock",
];

const PROVIDER_SUPPORTS_IMAGES: ModelProvider[] = [
  "openai",
  "ollama",
  "google-palm",
  "free-trial",
  "anthropic",
  "bedrock",
];

function modelSupportsImages(provider: ModelProvider, model: string): boolean {
  if (!PROVIDER_SUPPORTS_IMAGES.includes(provider)) {
    return false;
  }

  if (model.includes("llava")) {
    return true;
  }

  if (model.includes("claude-3")) {
    return true;
  }

  if (["gpt-4-vision-preview"].includes(model)) {
    return true;
  }

  if (
    model === "gemini-ultra" &&
    (provider === "google-palm" || provider === "free-trial")
  ) {
    return true;
  }

  return false;
}
const PARALLEL_PROVIDERS: ModelProvider[] = [
  "anthropic",
  "bedrock",
  "deepinfra",
  "gemini",
  "google-palm",
  "huggingface-inference-api",
  "huggingface-tgi",
  "mistral",
  "free-trial",
  "replicate",
  "together",
];

function llmCanGenerateInParallel(
  provider: ModelProvider,
  model: string,
): boolean {
  if (provider === "openai") {
    return model.includes("gpt");
  }

  return PARALLEL_PROVIDERS.includes(provider);
}

function autodetectTemplateType(model: string): TemplateType | undefined {
  const lower = model.toLowerCase();

  if (lower.includes("codellama") && lower.includes("70b")) {
    return "codellama-70b";
  }

  if (
    lower.includes("gpt") ||
    lower.includes("chat-bison") ||
    lower.includes("pplx") ||
    lower.includes("gemini")
  ) {
    return undefined;
  }

  if (lower.includes("llava")) {
    return "llava";
  }

  if (lower.includes("tinyllama")) {
    return "zephyr";
  }

  if (lower.includes("xwin")) {
    return "xwin-coder";
  }

  if (lower.includes("dolphin")) {
    return "chatml";
  }

  if (lower.includes("gemma")) {
    return "gemma";
  }

  if (lower.includes("phi2")) {
    return "phi2";
  }

  if (lower.includes("phind")) {
    return "phind";
  }

  if (lower.includes("llama")) {
    return "llama2";
  }

  if (lower.includes("zephyr")) {
    return "zephyr";
  }

  // Claude requests always sent through Messages API, so formatting not necessary
  if (lower.includes("claude")) {
    return "none";
  }

  if (lower.includes("alpaca") || lower.includes("wizard")) {
    return "alpaca";
  }

  if (lower.includes("mistral") || lower.includes("mixtral")) {
    return "llama2";
  }

  if (lower.includes("deepseek")) {
    return "deepseek";
  }

  if (lower.includes("ninja") || lower.includes("openchat")) {
    return "openchat";
  }

  if (lower.includes("neural-chat")) {
    return "neural-chat";
  }

  return "chatml";
}

function autodetectTemplateFunction(
  model: string,
  provider: ModelProvider,
  explicitTemplate: TemplateType | undefined = undefined,
) {
  if (
    explicitTemplate === undefined &&
    PROVIDER_HANDLES_TEMPLATING.includes(provider)
  ) {
    return null;
  }

  const templateType = explicitTemplate ?? autodetectTemplateType(model);

  if (templateType) {
    const mapping: Record<TemplateType, any> = {
      llama2: llama2TemplateMessages,
      alpaca: templateAlpacaMessages,
      phi2: phi2TemplateMessages,
      phind: phindTemplateMessages,
      zephyr: zephyrTemplateMessages,
      anthropic: anthropicTemplateMessages,
      chatml: chatmlTemplateMessages,
      deepseek: deepseekTemplateMessages,
      openchat: openchatTemplateMessages,
      "xwin-coder": xWinCoderTemplateMessages,
      "neural-chat": neuralChatTemplateMessages,
      llava: llavaTemplateMessages,
      "codellama-70b": codeLlama70bTemplateMessages,
      gemma: gemmaTemplateMessage,
      none: null,
    };

    return mapping[templateType];
  }

  return null;
}

const USES_OS_MODELS_EDIT_PROMPT: TemplateType[] = [
  "alpaca",
  "chatml",
  // "codellama-70b", Doesn't respond well to this prompt
  "deepseek",
  "gemma",
  "llama2",
  "llava",
  "neural-chat",
  "openchat",
  "phi2",
  "phind",
  "xwin-coder",
  "zephyr",
];

function autodetectPromptTemplates(
  model: string,
  explicitTemplate: TemplateType | undefined = undefined,
) {
  const templateType = explicitTemplate ?? autodetectTemplateType(model);
  const templates: Record<string, any> = {};

  let editTemplate = null;

  if (templateType && USES_OS_MODELS_EDIT_PROMPT.includes(templateType)) {
    // This is overriding basically everything else
    // Will probably delete the rest later, but for now it's easy to revert
    editTemplate = osModelsEditPrompt;
  } else if (templateType === "phind") {
    editTemplate = phindEditPrompt;
  } else if (templateType === "phi2") {
    editTemplate = simplifiedEditPrompt;
  } else if (templateType === "zephyr") {
    editTemplate = zephyrEditPrompt;
  } else if (templateType === "llama2") {
    if (model.includes("mistral")) {
      editTemplate = mistralEditPrompt;
    } else {
      editTemplate = osModelsEditPrompt;
    }
  } else if (templateType === "alpaca") {
    editTemplate = alpacaEditPrompt;
  } else if (templateType === "deepseek") {
    editTemplate = deepseekEditPrompt;
  } else if (templateType === "openchat") {
    editTemplate = openchatEditPrompt;
  } else if (templateType === "xwin-coder") {
    editTemplate = xWinCoderEditPrompt;
  } else if (templateType === "neural-chat") {
    editTemplate = neuralChatEditPrompt;
  } else if (templateType === "codellama-70b") {
    editTemplate = codeLlama70bEditPrompt;
  } else if (templateType === "anthropic") {
    editTemplate = claudeEditPrompt;
  } else if (templateType === "gemma") {
    editTemplate = gemmaEditPrompt;
  } else if (templateType) {
    editTemplate = gptEditPrompt;
  }

  if (editTemplate !== null) {
    templates["edit"] = editTemplate;
  }

  return templates;
}

export {
  autodetectPromptTemplates,
  autodetectTemplateFunction,
  autodetectTemplateType,
  llmCanGenerateInParallel,
  modelSupportsImages,
};
