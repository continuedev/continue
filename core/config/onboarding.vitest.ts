import { describe, expect, it } from "vitest";

import {
  getLocalOnboardingPrimaryModelTitle,
  setupLocalConfig,
} from "./onboarding";

describe("setupLocalConfig", () => {
  it("adds the default Ollama onboarding models", () => {
    const result = setupLocalConfig({
      name: "Local Config",
      version: "0.0.1",
      schema: "v1",
      models: [],
    });

    expect(result.models?.slice(0, 3)).toEqual([
      {
        name: "Llama 3.1 8B",
        provider: "ollama",
        model: "llama3.1:8b",
        roles: ["chat", "edit", "apply"],
      },
      {
        name: "Qwen2.5-Coder 1.5B",
        provider: "ollama",
        model: "qwen2.5-coder:1.5b-base",
        roles: ["autocomplete"],
      },
      {
        name: "Nomic Embed",
        provider: "ollama",
        model: "nomic-embed-text:latest",
        roles: ["embed"],
      },
    ]);
  });

  it("builds an LM Studio config from detected local models", () => {
    const result = setupLocalConfig(
      {
        name: "Local Config",
        version: "0.0.1",
        schema: "v1",
        models: [],
      },
      "lmstudio",
      [
        "text-embedding-nomic-embed-text-v1.5",
        "Qwen2.5-Coder-7B-Instruct-GGUF",
        "Meta-Llama-3.1-8B-Instruct-GGUF",
      ],
    );

    expect(result.models).toEqual([
      {
        name: "Meta-Llama-3.1-8B-Instruct-GGUF",
        provider: "lmstudio",
        model: "Meta-Llama-3.1-8B-Instruct-GGUF",
        roles: ["chat", "edit", "apply"],
      },
      {
        name: "Qwen2.5-Coder-7B-Instruct-GGUF",
        provider: "lmstudio",
        model: "Qwen2.5-Coder-7B-Instruct-GGUF",
        roles: ["autocomplete"],
      },
      {
        name: "text-embedding-nomic-embed-text-v1.5",
        provider: "lmstudio",
        model: "text-embedding-nomic-embed-text-v1.5",
        roles: ["embed"],
      },
    ]);
  });
});

describe("getLocalOnboardingPrimaryModelTitle", () => {
  it("returns the chosen LM Studio chat model title", () => {
    expect(
      getLocalOnboardingPrimaryModelTitle("lmstudio", [
        "Qwen2.5-Coder-7B-Instruct-GGUF",
        "Meta-Llama-3.1-8B-Instruct-GGUF",
      ]),
    ).toBe("Meta-Llama-3.1-8B-Instruct-GGUF");
  });
});
