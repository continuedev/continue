import {
  ChatMessage,
  ModelCapability,
  ModelDescription,
  TemplateType,
} from "../index.js";
import { NEXT_EDIT_MODELS } from "./constants.js";

import {
  anthropicTemplateMessages,
  chatmlTemplateMessages,
  codeLlama70bTemplateMessages,
  codestralTemplateMessages,
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

const PROVIDER_HANDLES_TEMPLATING: string[] = [
  "lmstudio",
  "lemonade",
  "openai",
  "nvidia",
  "ollama",
  "together",
  "novita",
  "msty",
  "anthropic",
  "bedrock",
  "cohere",
  "sagemaker",
  "continue-proxy",
  "mistral",
  "mimo",
  "sambanova",
  "vertexai",
  "watsonx",
  "nebius",
  "relace",
  "openrouter",
  "deepseek",
  "xAI",
  "groq",
  "gemini",
  "docker",
  // TODO add these, change to inverted logic so only the ones that need templating are hardcoded
  // Asksage.ts
  // Azure.ts
  // BedrockImport.ts
  // Cerebras.ts
  // Cloudflare.ts
  // CometAPI.ts
  // CustomLLM.ts
  // DeepInfra.ts
  // Fireworks.ts
  // Flowise.ts
  // FunctionNetwork.ts
  // HuggingFaceInferenceAPI.ts
  // HuggingFaceTEI.ts
  // HuggingFaceTGI.ts
  // Inception.ts
  // Kindo.ts
  // LlamaCpp.ts
  // LlamaStack.ts
  // Llamafile.ts
  // Mock.ts
  // Moonshot.ts
  // NCompass.ts
  // OVHcloud.ts
  // Replicate.ts
  // Scaleway.ts
  // SiliconFlow.ts
  // TARS.ts
  // Test.ts
  // TextGenWebUI.ts
  // TransformersJsEmbeddingsProvider.ts
  // Venice.ts
  // Vllm.ts
  // Voyage.ts
  // etc
];

const PROVIDER_SUPPORTS_IMAGES: string[] = [
  "openai",
  "ollama",
  "lemonade",
  "cohere",
  "gemini",
  "msty",
  "anthropic",
  "bedrock",
  "sagemaker",
  "continue-proxy",
  "openrouter",
  "venice",
  "sambanova",
  "vertexai",
  "azure",
  "scaleway",
  "nebius",
  "ovhcloud",
  "watsonx",
];

const MODEL_SUPPORTS_IMAGES: RegExp[] = [
  /llava/,
  /gpt-4-turbo/,
  /gpt-4o/,
  /gpt-4o-mini/,
  /claude-3/,
  /gemini-ultra/,
  /gemini-1\.5-pro/,
  /gemini-1\.5-flash/,
  /sonnet/,
  /opus/,
  /haiku/,
  /pixtral/,
  /llama-?3\.2/,
  /llama-?4/, // might use something like /llama-?(?:[4-9](?:\.\d+)?|\d{2,}(?:\.\d+)?)/ for forward compat, if needed
  /\bgemma-?3(?!n)/, // gemma3 supports vision, but gemma3n doesn't!
  /\b(pali|med)gemma/,
  /qwen(.*)vl/,
  /mistral-small/,
  /mistral-medium/,
];

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

  const lowerModel = model.toLowerCase();
  const lowerTitle = title?.toLowerCase() ?? "";

  if (
    lowerModel.includes("vision") ||
    lowerTitle.includes("vision") ||
    MODEL_SUPPORTS_IMAGES.some(
      (modelrx) => modelrx.test(lowerModel) || modelrx.test(lowerTitle),
    )
  ) {
    return true;
  }

  return false;
}

function modelSupportsReasoning(
  model: ModelDescription | null | undefined,
): boolean {
  if (!model) {
    return false;
  }
  if (model.completionOptions?.reasoning !== undefined) {
    // Reasoning support is forced at the config level. Model might not necessarily support it though!
    return model.completionOptions.reasoning;
  }
  // Seems our current way of disabling reasoning is not working for grok code so results in useless lightbulb
  // if (model.model.includes("grok-code")) {
  //   return true;
  // }
  // do not turn reasoning on by default for claude 3 models
  if (
    model.model.includes("claude") &&
    !model.model.includes("-3-") &&
    !model.model.includes("-3.5-")
  ) {
    return true;
  }
  if (model.model.includes("command-a-reasoning")) {
    return true;
  }
  if (model.model.includes("deepseek-r")) {
    return true;
  }

  return false;
}

const PARALLEL_PROVIDERS: string[] = [
  "anthropic",
  "bedrock",
  "cohere",
  "sagemaker",
  "deepinfra",
  "gemini",
  "huggingface-inference-api",
  "huggingface-tgi",
  "mistral",
  "moonshot",
  "replicate",
  "together",
  "novita",
  "sambanova",
  "ovhcloud",
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

function isProviderHandlesTemplatingOrNoTemplateTypeRequired(
  modelName: string,
): boolean {
  return (
    modelName.includes("gpt") ||
    modelName.includes("command") ||
    modelName.includes("aya") ||
    modelName.includes("chat-bison") ||
    modelName.includes("pplx") ||
    modelName.includes("gemini") ||
    modelName.includes("grok") ||
    modelName.includes("moonshot") ||
    modelName.includes("kimi") ||
    modelName.includes("mercury") ||
    /^o\d/.test(modelName)
  );
}

// NOTE: When updating this list,
// update core/nextEdit/templating/NextEditPromptEngine.ts as well.
const MODEL_SUPPORTS_NEXT_EDIT: string[] = [
  NEXT_EDIT_MODELS.MERCURY_CODER,
  NEXT_EDIT_MODELS.INSTINCT,
];

function modelSupportsNextEdit(
  capabilities: ModelCapability | undefined,
  model: string,
  title: string | undefined,
): boolean {
  if (capabilities?.nextEdit !== undefined) {
    return capabilities.nextEdit;
  }

  const lower = model.toLowerCase();
  if (
    MODEL_SUPPORTS_NEXT_EDIT.some(
      (modelName) => lower.includes(modelName) || title?.includes(modelName),
    )
  ) {
    return true;
  }

  return false;
}

function autodetectTemplateType(model: string): TemplateType | undefined {
  const lower = model.toLowerCase();

  if (lower.includes("codellama") && lower.includes("70b")) {
    return "codellama-70b";
  }

  if (isProviderHandlesTemplatingOrNoTemplateTypeRequired(lower)) {
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

  // Nova Pro requests always sent through Converse API, so formatting not necessary
  if (lower.includes("nova")) {
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
      codestral: codestralTemplateMessages,
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
  modelSupportsNextEdit,
  modelSupportsReasoning,
};
