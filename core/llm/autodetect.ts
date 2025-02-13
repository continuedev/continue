import {
  ChatMessage,
  ModelCapability,
  ModelDescription,
  TemplateType,
} from "../index.js";

import {
  anthropicTemplateMessages,
  chatmlTemplateMessages,
  codeLlama70bTemplateMessages,
  deepseekTemplateMessages,
  gemmaTemplateMessage,
  graniteTemplateMessages,
  llama2TemplateMessages,
  llama3TemplateMessages,
  llavaTemplateMessages,
  neuralChatTemplateMessages,
  openchatTemplateMessages,
  phi2TemplateMessages,
  phindTemplateMessages,
  templateAlpacaMessages,
  xWinCoderTemplateMessages,
  zephyrTemplateMessages,
} from "./templates/chat.js";
import {
  alpacaEditPrompt,
  claudeEditPrompt,
  codeLlama70bEditPrompt,
  deepseekEditPrompt,
  gemmaEditPrompt,
  gptEditPrompt,
  llama3EditPrompt,
  mistralEditPrompt,
  neuralChatEditPrompt,
  openchatEditPrompt,
  osModelsEditPrompt,
  phindEditPrompt,
  simplifiedEditPrompt,
  xWinCoderEditPrompt,
  zephyrEditPrompt,
} from "./templates/edit.js";
import { PROVIDER_TOOL_SUPPORT } from "./toolSupport.js";

const PROVIDER_HANDLES_TEMPLATING: string[] = [
  "lmstudio",
  "openai",
  "ollama",
  "together",
  "novita",
  "msty",
  "anthropic",
  "bedrock",
  "sagemaker",
  "continue-proxy",
  "mistral",
  "sambanova",
  "vertexai",
  "watsonx",
];

const PROVIDER_SUPPORTS_IMAGES: string[] = [
  "openai",
  "ollama",
  "gemini",
  "free-trial",
  "msty",
  "anthropic",
  "bedrock",
  "sagemaker",
  "continue-proxy",
  "openrouter",
  "vertexai",
  "azure",
  "scaleway",
];

const MODEL_SUPPORTS_IMAGES: string[] = [
  "llava",
  "gpt-4-turbo",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-vision",
  "claude-3",
  "gemini-ultra",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "sonnet",
  "opus",
  "haiku",
  "pixtral",
  "llama3.2",
];

function modelSupportsTools(modelDescription: ModelDescription) {
  if (modelDescription.capabilities?.tools) {
    return true;
  }
  const providerSupport = PROVIDER_TOOL_SUPPORT[modelDescription.provider];
  if (!providerSupport) {
    return false;
  }
  return providerSupport(modelDescription.model) ?? false;
}

function modelSupportsImages(
  provider: string,
  model: string,
  title: string | undefined,
  capabilities: ModelCapability | undefined,
): boolean {
  if (capabilities?.uploadImage !== undefined) {
    return capabilities.uploadImage;
  }
  if (!PROVIDER_SUPPORTS_IMAGES.includes(provider)) {
    return false;
  }

  const lower = model.toLowerCase();
  if (
    MODEL_SUPPORTS_IMAGES.some(
      (modelName) => lower.includes(modelName) || title?.includes(modelName),
    )
  ) {
    return true;
  }

  return false;
}
const PARALLEL_PROVIDERS: string[] = [
  "anthropic",
  "bedrock",
  "sagemaker",
  "deepinfra",
  "gemini",
  "huggingface-inference-api",
  "huggingface-tgi",
  "mistral",
  "moonshot",
  "free-trial",
  "replicate",
  "together",
  "novita",
  "sambanova",
  "nebius",
  "vertexai",
  "function-network",
  "scaleway",
];

function llmCanGenerateInParallel(provider: string, model: string): boolean {
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
    lower.includes("command") ||
    lower.includes("chat-bison") ||
    lower.includes("pplx") ||
    lower.includes("gemini") ||
    lower.includes("grok") ||
    lower.includes("moonshot")
  ) {
    return undefined;
  }
  if (lower.includes("llama3") || lower.includes("llama-3")) {
    return "llama3";
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

  if (lower.includes("codestral")) {
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

  if (lower.includes("granite")) {
    return "granite";
  }

  return "chatml";
}

function autodetectTemplateFunction(
  model: string,
  provider: string,
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
    const mapping: Record<
      TemplateType,
      null | ((msg: ChatMessage[]) => string)
    > = {
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
      granite: graniteTemplateMessages,
      llama3: llama3TemplateMessages,
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
  "llama3",
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
  } else if (templateType === "llama3") {
    editTemplate = llama3EditPrompt;
  } else if (templateType === "none") {
    editTemplate = null;
  } else if (templateType) {
    editTemplate = gptEditPrompt;
  } else if (model.includes("codestral")) {
    editTemplate = osModelsEditPrompt;
  }

  if (editTemplate !== null) {
    templates.edit = editTemplate;
  }

  return templates;
}

export {
  autodetectPromptTemplates,
  autodetectTemplateFunction,
  autodetectTemplateType,
  llmCanGenerateInParallel,
  modelSupportsImages,
  modelSupportsTools,
};
