import { parseProxyModelName } from "@continuedev/config-yaml";

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

      return [
        "claude-3-5",
        "claude-3.5",
        "claude-3-7",
        "claude-3.7",
        "claude-sonnet-4",
        "claude-4-sonnet",
        "gpt-4",
        "o3",
        "gemini",
        "claude-opus-4",
      ].some((part) => model.toLowerCase().startsWith(part));
    },
    anthropic: (model) => {
      if (
        [
          "claude-3-5",
          "claude-3.5",
          "claude-3-7",
          "claude-3.7",
          "claude-sonnet-4",
          "claude-4-sonnet",
          "claude-opus-4",
        ].some((part) => model.toLowerCase().startsWith(part))
      ) {
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

      return false;
    },
    cohere: (model) => {
      return model.toLowerCase().startsWith("command");
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
      if (
        [
          "claude-3-5-sonnet",
          "claude-3.5-sonnet",
          "claude-3-7-sonnet",
          "claude-3.7-sonnet",
          "claude-sonnet-4",
          "claude-4-sonnet",
          "claude-opus-4",
          "nova-lite",
          "nova-pro",
          "nova-micro",
          "nova-premier",
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
          "aya-expanse",
          "firefunction-v2",
          "mistral",
          "devstral",
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
        model.toLowerCase().includes("deepseek")
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
        "anthropic/claude-4",
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

      return false;
    },
  };
