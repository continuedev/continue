#!/usr/bin/env node

// Script to convert Docusaurus redirects to Mintlify format
// Run: node migrate-redirects.js

const fs = require("fs");
const path = require("path");

// Extract redirects from Docusaurus config
const docusaurusRedirects = [
  {
    to: "/hub/introduction",
    from: ["/hub"],
  },
  {
    to: "/hub/governance/org-permissions",
    from: "/hub/governance",
  },
  {
    to: "/hub/secrets/secret-types",
    from: "/hub/secrets",
  },
  {
    to: "/hub/assistants/intro",
    from: "/hub/assistants",
  },
  {
    to: "/hub/blocks/intro",
    from: "/hub/blocks",
  },
  {
    to: "/customization/overview",
    from: ["/customize", "/customization"],
  },
  {
    to: "/customization/mcp-tools",
    from: "/customize/tools",
  },
  {
    to: "/getting-started/install",
    from: ["/install/vscode", "/install/jetbrains"],
  },
  {
    to: "/customize/settings",
    from: ["/advanced/deep-dives/settings", "/customize/deep-dives/settings"],
  },
  {
    to: "/customize/model-roles/intro",
    from: [
      "/customize/model-types",
      "/setup/overview",
      "/advanced/model-roles/intro",
    ],
  },
  {
    to: "/customize/model-roles/embeddings",
    from: [
      "/customize/model-types/embeddings",
      "/advanced/model-roles/embeddings",
    ],
  },
  {
    to: "/customize/model-roles/autocomplete",
    from: [
      "/customize/model-types/autocomplete",
      "/advanced/model-roles/autocomplete",
    ],
  },
  {
    to: "/customize/model-roles/chat",
    from: ["/customize/model-types/chat", "/advanced/model-roles/chat"],
  },
  {
    to: "/customize/model-roles/reranking",
    from: [
      "/customize/model-types/reranking",
      "/advanced/model-roles/reranking",
    ],
  },
  {
    to: "/getting-started/overview",
    from: [
      "/model-setup/overview",
      "/model-setup/select-model",
      "/model-setup/configuration",
      "/quickstart",
      "/how-to-use-continue",
    ],
  },
  {
    to: "/customize/model-providers/anthropic",
    from: [
      "/setup/select-provider",
      "/setup/model-providers",
      "/advanced/model-providers/anthropic",
    ],
  },
  {
    to: "/customize/context/codebase",
    from: [
      "/walkthroughs/codebase-embeddings",
      "/features/codebase-embeddings",
      "/advanced/deep-dives/codebase",
      "/advanced/context/codebase",
    ],
  },
  {
    to: "/customize/deep-dives/autocomplete",
    from: [
      "/walkthroughs/tab-autocomplete",
      "/features/tab-autocomplete",
      "/advanced/deep-dives/autocomplete",
    ],
  },
  {
    to: "/customize/deep-dives/prompts",
    from: [
      "/walkthroughs/prompt-files",
      "/features/prompt-files",
      "/advanced/deep-dives/prompts",
    ],
  },
  {
    to: "/customize/deep-dives/slash-commands",
    from: [
      "/actions/how-to-use-it",
      "/actions/how-to-customize",
      "/actions",
      "/actions/model-setup",
      "/actions/context-selection",
      "/actions/how-it-works",
      "/customize/slash-commands",
      "/customization/slash-commands",
      "/advanced/deep-dives/slash-commands",
    ],
  },
  {
    to: "/customize/deep-dives/vscode-actions",
    from: [
      "/walkthroughs/quick-actions",
      "/advanced/deep-dives/vscode-actions",
    ],
  },
  {
    to: "/reference",
    from: "/changelog",
  },
  {
    to: "/reference",
    from: [
      "/customization/code-config",
      "/reference/config",
      "/yaml-reference",
    ],
  },
  {
    to: "/customize/custom-providers",
    from: [
      "/customization/context-providers",
      "/advanced/context-integration/custom-providers",
      "/advanced/context/custom-providers",
      "/advanced/custom-providers",
    ],
  },
  {
    to: "/customize/deep-dives/development-data",
    from: [
      "/development-data",
      "/customize/development-data",
      "/advanced/deep-dives/development-data",
    ],
  },
  {
    to: "/customize/context/documentation",
    from: [
      "/features/talk-to-your-docs",
      "/advanced/context-integration/documentation",
      "/advanced/deep-dives/docs",
      "/advanced/context/documentation",
    ],
  },
  {
    to: "/customize/model-providers/anthropic",
    from: ["/reference/Model Providers/anthropicllm"],
  },
  {
    to: "/customize/model-providers/azure",
    from: [
      "/reference/Model Providers/azure",
      "/advanced/model-providers/azure",
    ],
  },
  {
    to: "/customize/model-providers/bedrock",
    from: [
      "/reference/Model Providers/bedrock",
      "/advanced/model-providers/bedrock",
    ],
  },
  {
    to: "/customize/model-providers/deepseek",
    from: [
      "/reference/Model Providers/deepseek",
      "/advanced/model-providers/deepseek",
    ],
  },
  {
    to: "/customize/model-providers/anthropic",
    from: "/reference/Model Providers/freetrial",
  },
  {
    to: "/customize/model-providers/gemini",
    from: [
      "/reference/Model Providers/geminiapi",
      "/advanced/model-providers/gemini",
    ],
  },
  {
    to: "/customize/model-providers/mistral",
    from: [
      "/reference/Model Providers/mistral",
      "/advanced/model-providers/mistral",
    ],
  },
  {
    to: "/customize/model-providers/ollama",
    from: [
      "/reference/Model Providers/ollama",
      "/advanced/model-providers/ollama",
    ],
  },
  {
    to: "/customize/model-providers/openai",
    from: [
      "/reference/Model Providers/openai",
      "/advanced/model-providers/openai",
    ],
  },
  {
    to: "/",
    from: "/intro",
  },
  {
    to: "/customize/model-providers/more/cloudflare",
    from: [
      "/reference/Model Providers/cloudflare",
      "/advanced/model-providers/more/cloudflare",
    ],
  },
  {
    to: "/customize/model-providers/more/cohere",
    from: [
      "/reference/Model Providers/cohere",
      "/advanced/model-providers/more/cohere",
    ],
  },
  {
    to: "/customize/model-providers/more/deepinfra",
    from: [
      "/reference/Model Providers/deepinfra",
      "/advanced/model-providers/more/deepinfra",
    ],
  },
  {
    to: "/customize/model-providers/more/flowise",
    from: [
      "/reference/Model Providers/flowise",
      "/advanced/model-providers/more/flowise",
    ],
  },
  {
    to: "/customize/model-providers/llamastack",
    from: "/advanced/model-providers/more/llamastack",
  },
  {
    to: "/customize/model-providers/more/huggingfaceinferenceapi",
    from: [
      "/reference/Model Providers/huggingfaceinferenceapi",
      "/advanced/model-providers/more/huggingfaceinferenceapi",
    ],
  },
  {
    to: "/customize/model-providers/more/ipex_llm",
    from: [
      "/reference/Model Providers/ipex_llm",
      "/advanced/model-providers/more/ipex_llm",
    ],
  },
  {
    to: "/customize/model-providers/more/kindo",
    from: [
      "/reference/Model Providers/kindo",
      "/advanced/model-providers/more/kindo",
    ],
  },
  {
    to: "/customize/model-providers/more/llamacpp",
    from: [
      "/reference/Model Providers/llamacpp",
      "/advanced/model-providers/more/llamacpp",
    ],
  },
  {
    to: "/customize/model-providers/more/llamafile",
    from: [
      "/reference/Model Providers/llamafile",
      "/advanced/model-providers/more/llamafile",
    ],
  },
  {
    to: "/customize/model-providers/more/lmstudio",
    from: [
      "/reference/Model Providers/lmstudio",
      "/advanced/model-providers/more/lmstudio",
    ],
  },
  {
    to: "/customize/model-providers/more/msty",
    from: [
      "/reference/Model Providers/msty",
      "/advanced/model-providers/more/msty",
    ],
  },
  {
    to: "/customize/model-providers/more/openrouter",
    from: [
      "/reference/Model Providers/openrouter",
      "/advanced/model-providers/more/openrouter",
    ],
  },
  {
    to: "/customize/model-providers/more/replicatellm",
    from: [
      "/reference/Model Providers/replicatellm",
      "/advanced/model-providers/more/replicatellm",
    ],
  },
  {
    to: "/customize/model-providers/more/sagemaker",
    from: [
      "/reference/Model Providers/sagemaker",
      "/advanced/model-providers/more/sagemaker",
    ],
  },
  {
    to: "/customize/model-providers/more/textgenwebui",
    from: [
      "/reference/Model Providers/textgenwebui",
      "/advanced/model-providers/more/textgenwebui",
    ],
  },
  {
    to: "/customize/model-providers/more/together",
    from: [
      "/reference/Model Providers/together",
      "/advanced/model-providers/more/together",
    ],
  },
  {
    to: "/customize/model-providers/more/novita",
    from: [
      "/reference/Model Providers/novita",
      "/advanced/model-providers/more/novita",
    ],
  },
  {
    to: "/customize/model-providers/more/vllm",
    from: [
      "/reference/Model Providers/vllm",
      "/advanced/model-providers/more/vllm",
    ],
  },
  {
    to: "/customize/model-providers/more/watsonx",
    from: [
      "/reference/Model Providers/watsonx",
      "/advanced/model-providers/more/watsonx",
    ],
  },
  {
    to: "/customize/model-providers/more/nebius",
    from: [
      "/reference/Model Providers/nebius",
      "/advanced/model-providers/more/nebius",
    ],
  },
  {
    to: "/features/chat/quick-start",
    from: ["/chat", "/chat/how-to-use-it"],
  },
  {
    to: "/features/agent/quick-start",
    from: ["/agent", "/agent/how-to-use-it"],
  },
  {
    to: "/features/edit/quick-start",
    from: ["/edit", "/edit/how-to-use-it"],
  },
  {
    to: "/features/autocomplete/quick-start",
    from: ["/autocomplete", "/autocomplete/how-to-use-it"],
  },
  {
    to: "/getting-started/install",
    from: "/getting-started",
  },
  {
    to: "/customize/deep-dives/prompts",
    from: "/customize/deep-dives/prompt-files",
  },
  {
    to: "/features/chat/how-it-works",
    from: "/chat/how-it-works",
  },
  {
    to: "/features/autocomplete/how-it-works",
    from: "/autocomplete/how-it-works",
  },
  {
    to: "/features/edit/how-it-works",
    from: "/edit/how-it-works",
  },
  {
    to: "/features/agent/how-it-works",
    from: "/agent/how-it-works",
  },
  {
    to: "/customize/telemetry",
    from: ["/telemetry", "/advanced/telemetry"],
  },
  {
    to: "/customize/yaml-migration",
    from: ["/yaml-migration", "/advanced/yaml-migration"],
  },
  {
    to: "/customize/json-reference",
    from: ["/json-reference", "/advanced/json-reference"],
  },
];

// Convert to Mintlify format
function convertToMintlifyRedirects(docusaurusRedirects) {
  const mintlifyRedirects = [];

  docusaurusRedirects.forEach((redirect) => {
    const destination = redirect.to;
    const sources = Array.isArray(redirect.from)
      ? redirect.from
      : [redirect.from];

    sources.forEach((source) => {
      mintlifyRedirects.push({
        source: source,
        destination: destination,
      });
    });
  });

  return mintlifyRedirects;
}

// Generate the Mintlify redirects
const mintlifyRedirects = convertToMintlifyRedirects(docusaurusRedirects);

// Read current mint.json
const mintJsonPath = path.join(__dirname, "mint.json");
const mintJson = JSON.parse(fs.readFileSync(mintJsonPath, "utf8"));

// Add redirects to mint.json
mintJson.redirects = mintlifyRedirects;

// Write back to mint.json
fs.writeFileSync(mintJsonPath, JSON.stringify(mintJson, null, 2));

console.log(
  `✅ Successfully migrated ${mintlifyRedirects.length} redirects to mint.json`,
);
console.log(`📝 Redirects added to mint.json`);

// Also output the redirects for review
console.log("\n📋 Sample redirects:");
mintlifyRedirects.slice(0, 10).forEach((redirect) => {
  console.log(`  ${redirect.source} → ${redirect.destination}`);
});
console.log(`  ... and ${mintlifyRedirects.length - 10} more`);
