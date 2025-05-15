export const PROVIDER_TOOL_SUPPORT: Record<
  string,
  (model: string) => boolean | undefined
> = {
  "continue-proxy": (model) => {
    // see getContinueProxyModelName
    const provider = model.split("/")[2];
    const _model = model.split("/")[3];
    if (provider && _model && provider !== "continue-proxy") {
      const fn = PROVIDER_TOOL_SUPPORT[provider];
      if (fn) {
        return fn(_model);
      }
    }
    return [
      "claude-3-5",
      "claude-3.5",
      "claude-3-7",
      "claude-3.7",
      "gpt-4",
      "o3",
      "gemini",
    ].some((part) => model.toLowerCase().startsWith(part));
  },
  anthropic: (model) => {
    if (
      ["claude-3-5", "claude-3.5", "claude-3-7", "claude-3.7"].some((part) =>
        model.toLowerCase().startsWith(part),
      )
    ) {
      return true;
    }
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
    // https://platform.openai.com/docs/guides/function-calling#models-supporting-function-calling
    if (
      model.toLowerCase().startsWith("gpt-4") ||
      model.toLowerCase().startsWith("o3")
    ) {
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
  },
  gemini: (model) => {
    // All gemini models support function calling
    return model.toLowerCase().includes("gemini");
  },
  vertexai: (model) => {
    // All gemini models except flash 2.0 lite support function calling
    return (
      model.toLowerCase().includes("gemini") &&
      !model.toLowerCase().includes("lite")
    );
  },
  bedrock: (model) => {
    // For Bedrock, only support Claude Sonnet models with versions 3.5/3-5 and 3.7/3-7
    if (
      model.toLowerCase().includes("sonnet") &&
      ["claude-3-5", "claude-3.5", "claude-3-7", "claude-3.7"].some((part) =>
        model.toLowerCase().includes(part),
      )
    ) {
      return true;
    }
  },
  mistral: (model) => {
    // https://docs.mistral.ai/capabilities/function_calling/
    return (
      !model.toLowerCase().includes("mamba") &&
      [
        "codestral",
        "mistral-large",
        "mistral-small",
        "pixtral",
        "ministral",
        "mistral-nemo",
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
        "smollm2",
        "hermes3",
        "athene-v2",
        "nemotron",
        "llama3-groq",
        "granite3",
        "granite-3",
        "aya-expanse",
        "firefunction-v2",
        "mistral",
      ].some((part) => modelName.toLowerCase().includes(part))
    ) {
      return true;
    }
  },
  sambanova: (model) => {
    // https://docs.sambanova.ai/cloud/docs/capabilities/function-calling
    if (
      model.toLowerCase().startsWith("meta-llama-3") ||
      model.toLowerCase().includes("llama-4") ||
      model.toLowerCase().includes("deepseek")
    ) {
      return true;
    }
  },
  deepseek: (model) => {
    if (model !== "deepseek-reasoner") {
      return true;
    }
  },
  watsonx: (model) => {
    if (model.toLowerCase().includes("guard")) return false;
    if (
      ["llama-3", "llama-4", "mistral", "codestral", "granite-3"].some((part) =>
        model.toLowerCase().includes(part),
      )
    )
      return true;
  },
  openrouter: (model) => {
    // https://openrouter.ai/models?fmt=cards&supported_parameters=tools
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
      "anthropic/claude-3",
      "microsoft/phi-3",
      "google/gemini-flash-1.5",
      "google/gemini-2",
      "google/gemini-pro",
      "x-ai/grok",
      "qwen/qwen3",
      "qwen/qwen-",
      "cohere/command-r",
      "ai21/jamba-1.6",
      "mistralai/mistral",
      "mistralai/ministral",
      "mistralai/codestral",
      "mistralai/mixtral",
      "mistral/ministral",
      "mistralai/pixtral",
      "meta-llama/llama-3.3",
      "amazon/nova",
      "deepseek/deepseek-r1",
      "deepseek/deepseek-chat",
      "meta-llama/llama-4",
      "all-hands/openhands-lm-32b",
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
  },
};
