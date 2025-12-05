import { parseProxyModelName } from "@continuedev/config-yaml";
import { ModelDescription } from "..";

export const PROVIDER_TOOL_SUPPORT: Record<string, (model: string) => boolean> =
  {
    "continue-proxy": (model) => {
      try {
        const { provider, model: _model } = parseProxyModelName(model);
        if (provider && _model && provider !== "continue-proxy") {
          const fn = PROVIDER_TOOL_SUPPORT[provider];
          if (fn) {
            return fn(_model);
          }
        }
      } catch (e) {}

      return ["claude", "gpt-4", "o3", "gemini", "gemma"].some((part) =>
        model.toLowerCase().startsWith(part),
      );
    },
    anthropic: (model) => {
      if (model.includes("claude-2") || model.includes("claude-instant")) {
        return false;
      }
      if (["claude"].some((part) => model.toLowerCase().startsWith(part))) {
        return true;
      }
      return false;
    },
    azure: (model) => {
      if (
        model.toLowerCase().startsWith("gpt-4") ||
        model.toLowerCase().startsWith("o3")
      )
        return true;
      return false;
    },
    openai: (model) => {
      const lower = model.toLowerCase();
      // https://platform.openai.com/docs/guides/function-calling#models-supporting-function-calling
      if (
        lower.startsWith("gpt-4") ||
        lower.startsWith("gpt-5") ||
        lower.startsWith("o3")
      ) {
        return true;
      }

      // LGAI EXAONE models expose an OpenAI-compatible API with tool
      // calling support when served via frameworks like vLLM
      if (lower.includes("exaone")) {
        return true;
      }

      if (lower.includes("gpt-oss")) {
        return true;
      }

      // https://ai.google.dev/gemma/docs/capabilities/function-calling
      if (lower.startsWith("gemma")) {
        return true;
      }

      // firworks-ai https://docs.fireworks.ai/guides/function-calling
      if (model.startsWith("accounts/fireworks/models/")) {
        switch (model.substring(26)) {
          case "llama-v3p1-405b-instruct":
          case "llama-v3p1-70b-instruct":
          case "qwen2p5-72b-instruct":
          case "firefunction-v1":
          case "firefunction-v2":
            return true;
          default:
            return false;
        }
      }

      return false;
    },
    cohere: (model) => {
      const lower = model.toLowerCase();
      if (lower.startsWith("command-a-vision")) {
        return false;
      }
      return lower.startsWith("command");
    },
    gemini: (model) => {
      // All gemini models support function calling
      return model.toLowerCase().includes("gemini");
    },
    vertexai: (model) => {
      const lowerCaseModel = model.toLowerCase();
      // All gemini models except flash 2.0 lite support function calling
      if (lowerCaseModel.includes("lite")) {
        return false;
      }
      return ["claude", "gemini"].some((val) => lowerCaseModel.includes(val));
    },
    xAI: (model) => {
      const lowerCaseModel = model.toLowerCase();
      return ["grok-3", "grok-4", "grok-4-1", "grok-code"].some((val) =>
        lowerCaseModel.includes(val),
      );
    },
    bedrock: (model) => {
      if (model.includes("claude-2") || model.includes("claude-instant")) {
        return false;
      }
      if (
        [
          "claude",
          "nova-lite",
          "nova-pro",
          "nova-micro",
          "nova-premier",
          "gpt-oss",
        ].some((part) => model.toLowerCase().includes(part))
      ) {
        return true;
      }

      return false;
    },
    mistral: (model) => {
      // https://docs.mistral.ai/capabilities/function_calling/
      return (
        !model.toLowerCase().includes("mamba") &&
        [
          "devstral",
          "codestral",
          "mistral-large",
          "mistral-small",
          "pixtral",
          "ministral",
          "mistral-nemo",
          "devstral",
        ].some((part) => model.toLowerCase().includes(part))
      );
    },
    // https://ollama.com/search?c=tools
    ollama: (model) => {
      let modelName = "";
      // Extract the model name after the last slash to support other registries
      if (model.includes("/")) {
        let parts = model.split("/");
        modelName = parts[parts.length - 1];
      } else {
        modelName = model;
      }

      if (
        ["vision", "math", "guard", "mistrallite", "mistral-openorca"].some(
          (part) => modelName.toLowerCase().includes(part),
        )
      ) {
        return false;
      }
      if (
        [
          "cogito",
          "llama3.3",
          "qwq",
          "llama3.2",
          "llama3.1",
          "qwen2",
          "qwen3",
          "mixtral",
          "command-r",
          "command-a",
          "smollm2",
          "hermes3",
          "athene-v2",
          "nemotron",
          "llama3-groq",
          "granite3",
          "granite-3",
          "granite4",
          "granite-4",
          "aya-expanse",
          "firefunction-v2",
          "mistral",
          "devstral",
          "exaone",
          "gpt-oss",
        ].some((part) => modelName.toLowerCase().includes(part))
      ) {
        return true;
      }

      return false;
    },
    sambanova: (model) => {
      // https://docs.sambanova.ai/cloud/docs/capabilities/function-calling
      if (
        model.toLowerCase().startsWith("meta-llama-3") ||
        model.toLowerCase().includes("llama-4") ||
        model.toLowerCase().includes("deepseek") ||
        model.toLowerCase().includes("gpt") ||
        model.toLowerCase().includes("qwen")
      ) {
        return true;
      }

      return false;
    },
    deepseek: (model) => {
      // https://api-docs.deepseek.com/quick_start/pricing
      // https://api-docs.deepseek.com/guides/function_calling
      if (model === "deepseek-reasoner" || model === "deepseek-chat") {
        return true;
      }

      return false;
    },
    watsonx: (model) => {
      if (model.toLowerCase().includes("guard")) {
        return false;
      }
      if (
        [
          "llama-3",
          "llama-4",
          "mistral",
          "codestral",
          "granite-3",
          "devstral",
        ].some((part) => model.toLowerCase().includes(part))
      ) {
        return true;
      }

      return false;
    },
    openrouter: (model) => {
      // https://openrouter.ai/models?fmt=cards&supported_parameters=tools

      // Specific free models that don't support tools
      // Fixes issue #6619 - moonshotai/kimi-k2:free causing 400 errors
      if (model.toLowerCase() === "moonshotai/kimi-k2:free") {
        return false;
      }

      if (
        ["vision", "math", "guard", "mistrallite", "mistral-openorca"].some(
          (part) => model.toLowerCase().includes(part),
        )
      ) {
        return false;
      }

      const supportedPrefixes = [
        "openai/gpt-3.5",
        "openai/gpt-4",
        "openai/o1",
        "openai/o3",
        "openai/o4",
        "openai/gpt-oss",
        "anthropic/claude",
        "microsoft/phi-3",
        "google/gemini-flash-1.5",
        "google/gemini-2",
        "google/gemini-pro",
        "x-ai/grok",
        "qwen/qwen3",
        "qwen/qwen-",
        "cohere/command-r",
        "cohere/command-a",
        "ai21/jamba-1.6",
        "mistralai/mistral",
        "mistralai/ministral",
        "mistralai/codestral",
        "mistralai/mixtral",
        "mistral/ministral",
        "mistral/devstral",
        "mistralai/pixtral",
        "meta-llama/llama-3.3",
        "amazon/nova",
        "deepseek/deepseek-r1",
        "deepseek/deepseek-chat",
        "meta-llama/llama-4",
        "all-hands/openhands-lm-32b",
        "lgai-exaone/exaone",
      ];
      for (const prefix of supportedPrefixes) {
        if (model.toLowerCase().startsWith(prefix)) {
          return true;
        }
      }

      const specificModels = [
        "qwen/qwq-32b",
        "qwen/qwen-2.5-72b-instruct",
        "meta-llama/llama-3.2-3b-instruct",
        "meta-llama/llama-3-8b-instruct",
        "meta-llama/llama-3-70b-instruct",
        "arcee-ai/caller-large",
        "nousresearch/hermes-3-llama-3.1-70b",
        "moonshotai/kimi-k2",
      ];
      for (const model of specificModels) {
        if (model.toLowerCase() === model) {
          return true;
        }
      }

      const supportedContains = ["llama-3.1"];
      for (const model of supportedContains) {
        if (model.toLowerCase().includes(model)) {
          return true;
        }
      }

      return false;
    },
    moonshot: (model) => {
      // support moonshot models
      // https://platform.moonshot.ai/docs/pricing/chat#concepts
      if (
        model.toLowerCase().startsWith("kimi") &&
        model.toLowerCase() !== "kimi-thinking-preview"
      ) {
        return true;
      }

      if (model.toLowerCase().startsWith("moonshot")) {
        return true;
      }

      return false;
    },
    novita: (model) => {
      const lower = model.toLowerCase();

      // Exact match models
      const exactMatches = [
        "deepseek/deepseek-r1-0528",
        "deepseek/deepseek-r1-turbo",
        "deepseek/deepseek-v3-0324",
        "deepseek/deepseek-v3-turbo",
        "meta-llama/llama-3.3-70b-instruct",
        "qwen/qwen-2.5-72b-instruct",
        "zai-org/glm-4.5",
        "moonshotai/kimi-k2-instruct",
      ];

      if (exactMatches.includes(lower)) {
        return true;
      }

      // Prefix match models
      const prefixMatches = ["qwen/qwen3", "openai/gpt-oss"];

      for (const prefix of prefixMatches) {
        if (lower.startsWith(prefix)) {
          return true;
        }
      }

      return false;
    },
  };

export function isRecommendedAgentModel(modelName: string): boolean {
  // AND behavior
  const recs: RegExp[][] = [
    [/o[134]/],
    [/deepseek/, /r1|reasoner/],
    [/gemini/, /2\.5/, /pro/],
    [/gemini/, /3-pro/],
    [/gpt/, /-5|5\.1/],
    [/claude/, /sonnet/, /3\.7|3-7|-4/],
    [/claude/, /opus/, /-4/],
    [/grok-code/],
    [/grok-4-1|grok-4\.1/],
    [/claude/, /4-5/],
  ];
  for (const combo of recs) {
    if (combo.every((regex) => modelName.toLowerCase().match(regex))) {
      return true;
    }
  }
  return false;
}
export function modelSupportsNativeTools(modelDescription: ModelDescription) {
  if (modelDescription.capabilities?.tools !== undefined) {
    return modelDescription.capabilities.tools;
  }

  const providerSupport = PROVIDER_TOOL_SUPPORT[modelDescription.provider];
  if (!providerSupport) {
    return false;
  }
  return providerSupport(modelDescription.model) ?? false;
}
