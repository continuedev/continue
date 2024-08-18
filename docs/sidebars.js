/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    {
      type: "category",
      label: "🚀 Install",
      collapsible: true,
      collapsed: true,
      items: [
        "intro",
        "install/vscode",
        "install/jetbrains",
        "how-to-use-continue",
        "troubleshooting"
      ],
    },
    {
      type: "category",
      label: "📚 Tutorials",
      collapsible: true,
      collapsed: true,
      items: [
        "tutorials/continue-fundamentals",
        "tutorials/how-to-use-config-json",
        "tutorials/configuration-examples",
        "tutorials/select-an-llm",
        "tutorials/authentication",
        "tutorials/set-up-codestral",
        "tutorials/llama3.1",
        "tutorials/running-without-internet",
        "tutorials/llm-context-length",
        "tutorials/customizing-the-llm-capability",
      ],
    },
    {
      type: "category",
      label: "⭐ Features",
      collapsible: true,
      collapsed: true,
      items: [
        "features/codebase-embeddings",
        "features/talk-to-your-docs",
        "features/tab-autocomplete",
        "features/context-providers",
        "features/slash-commands",
        "features/prompt-files",
        "features/quick-actions",
      ],
    },
    {
      type: "category",
      label: "🔬 Advanced",
      collapsible: true,
      collapsed: true,
      items: [
        "advanced/custom-llm-provider",
        "advanced/custom-context-provider",
        "advanced/custom-embedding-provider",
        "advanced/custom-slash-command",
        "advanced/customizing-the-chat-template",
        "advanced/customizing-edit-commands-prompt"
      ],
    },
    {
      type: "category",
      label: "🧑‍💻 Privacy",
      collapsible: true,
      collapsed: true,
      items: [
        "privacy/development-data",
        "privacy/telemetry",
        {
          type: "link",
          label: "Privacy Policy",
          href: "https://www.continue.dev/privacy",
        },
      ],
    },
  ],
  referenceSidebar: [
    "reference/config",
    "reference/llm-providers",
    "reference/embedding-providers",
    "reference/reranking-providers",
  ],
  communitySidebar: [
    "community/community",
    "community/code-of-conduct",
    "community/roadmap",
    "community/contributing",
    {
      type: "category",
      label: "📝 Changelog",
      collapsible: true,
      collapsed: true,
      items: [
        "community/change-log-vs-code",
        "community/change-log-intellij",
      ],
    },
    "community/support",
  ],
};

module.exports = sidebars;
