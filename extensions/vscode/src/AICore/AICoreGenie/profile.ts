// BAS Customization
import type { GenieProfile } from "@sap/gai-core";

export function getProfile() {
  return {
    ID: "auto-completion-genie",
    version: "1.0",
    name: "BAS Joule for AI Code Assistant extension",
    alias: "continue",
    description: "I’m Joule, your specialized AI assistant.",
    knowledge: {
      role: "",
      rules: [],
    },
    feature: {
      maxChatRounds: NaN,
      streaming: true,
    },
    examples: [],
    context: {
      metadata: [],
      contextSyntax: "",
    },
    llmModel: {
      vendor: "openai-gpt",
      settings: {
        model_name: "gpt-4o-mini",
        temperature: 0.5,
      },
    },
    actions: [
      {
        name: "showResult",
        label: "Show Result",
        language: "plaintext",
        icon: "codicon:info",
      },
      {
        name: "previewStaging",
        label: "Preview App",
        language: "plaintext",
        icon: "codicon:info",
      },
    ],
  } as GenieProfile;
}
