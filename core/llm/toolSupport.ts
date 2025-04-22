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
    return model.toLowerCase().includes("gemini") && !model.toLowerCase().includes("lite");;
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
  // https://ollama.com/search?c=tools
  ollama: (model) => {
    let modelName = "";
    // Extract the model name after the last slash to support other registries
    if(model.includes("/")) {
      let parts = model.split('/');
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
      model.toLowerCase().startsWith("meta-llama-3")
    ) {
      return true;
    }
  },
  deepseek: (model) => {
    if(model !== "deepseek-reasoner") {
      return true;
    }
  }
};
