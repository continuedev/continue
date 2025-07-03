// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const { themes } = require("prism-react-renderer");
const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

/** @type {import("@docusaurus/types").Config} */
const config = {
  // Docusaurus V3.6 experimental faster compile features
  // https://docusaurus.io/blog/releases/3.6#adoption-strategy
  future: {
    experimental_faster: true,
  },

  title: "Continue",
  tagline:
    "the open-source library for accelerating software development with language models",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://docs.continue.dev",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "continuedev", // Usually your GitHub org/user name.
  projectName: "continue", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: [
      "en",
      // "zh-CN"
    ],
  },

  themes: [],

  presets: [
    [
      "classic",
      /** @type {import("@docusaurus/preset-classic").Options} */
      ({
        docs: {
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl: "https://github.com/continuedev/continue/tree/main/docs",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
        ...(process.env.NODE_ENV === "production" && {
          gtag: {
            trackingID: "G-M3JWW8N2XQ",
            anonymizeIP: true,
          },
        }),
      }),
    ],
  ],

  scripts: [
    {
      src: "/scripts/custom-reo.js", // it references from static folder
    },
  ],

  themeConfig:
    /** @type {import("@docusaurus/preset-classic").ThemeConfig} */
    ({
      metadata: [
        {
          name: "keywords",
          content:
            "open source, ai, vscode, intellij, jetbrains, developer tools, chatgpt, copilot, llm",
        },
      ],
      // Replace with your project's social card
      image: "https://docs.continue.dev/img/continue-social-card.png",
      navbar: {
        title: "Continue",
        logo: {
          alt: "Continue Logo",
          src: "img/logo.png",
          href: "https://continue.dev",
          target: "_blank",
        },
        items: [
          {
            type: "docSidebar",
            sidebarId: "docsSidebar",
            position: "left",
            label: "Documentation",
            href: "/",
          },
          {
            to: "/guides/overview",
            label: "Guides",
            position: "left",
          },
          {
            to: "https://hub.continue.dev",
            label: "Explore",
            position: "left",
          },

          {
            to: "https://github.com/continuedev/continue",
            label: "GitHub",
            position: "right",
            className: "github-navbar",
          },
          {
            to: "https://discord.gg/vapESyrFmJ",
            label: "Discord",
            position: "right",
            className: "discord-navbar",
          },
          {
            type: "localeDropdown",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Extensions",
            items: [
              {
                label: "VS Code",
                to: "https://marketplace.visualstudio.com/items?itemName=Continue.continue",
              },
              {
                label: "JetBrains",
                to: "https://plugins.jetbrains.com/plugin/22707-continue-extension",
              },
            ],
          },
          {
            title: "Community",
            items: [
              {
                label: "Discord",
                to: "https://discord.gg/vapESyrFmJ",
              },
              {
                label: "GitHub",
                to: "https://github.com/continuedev/continue",
              },
            ],
          },
          {
            title: "Follow Us",
            items: [
              {
                label: "Twitter",
                to: "https://twitter.com/continuedev",
              },
              {
                label: "LinkedIn",
                to: "https://linkedin.com/company/continuedev",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Continue Dev, Inc.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ["json"],
      },
      algolia: {
        // The application ID provided by Algolia
        appId: "0OMUMCQZVV",

        // Public API key: it is safe to commit it
        apiKey: "6795de0f612eebe17018f8061a9ef18e",

        indexName: "continue",

        // Optional: see doc section below
        contextualSearch: true,
      },
    }),
  plugins: [
    [
      "posthog-docusaurus",
      {
        apiKey: process.env.POSTHOG_API_KEY || "DEV",
        appUrl: "https://us.i.posthog.com",
        enableInDevelopment: false,
      },
    ],
    [
      "docusaurus-plugin-llms-txt",
      {
        // Optional configuration
        outputPath: "static/llms.txt",
        includePatterns: ["docs/**"],
        excludePatterns: ["**/node_modules/**"],
      },
    ],
    [
      "@docusaurus/plugin-client-redirects",
      {
        redirects: [
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
            to: "/advanced/deep-dives/settings",
            from: "/customize/settings",
          },
          {
            to: "/advanced/model-roles/intro",
            from: ["/customize/model-types", "/setup/overview"],
          },
          {
            to: "/advanced/model-roles/embeddings",
            from: "/customize/model-types/embeddings",
          },
          {
            to: "/advanced/model-roles/autocomplete",
            from: "/customize/model-types/autocomplete",
          },
          {
            to: "/advanced/model-roles/chat",
            from: "/customize/model-types/chat",
          },
          {
            to: "/advanced/model-roles/reranking",
            from: "/customize/model-types/reranking",
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
            to: "/advanced/model-providers/anthropic",
            from: ["/setup/select-provider", "/setup/model-providers"],
          },
          {
            to: "/advanced/deep-dives/codebase",
            from: [
              "/walkthroughs/codebase-embeddings",
              "/features/codebase-embeddings",
            ],
          },
          {
            to: "/advanced/deep-dives/autocomplete",
            from: [
              "/walkthroughs/tab-autocomplete",
              "/features/tab-autocomplete",
            ],
          },
          {
            to: "/advanced/deep-dives/prompts",
            from: ["/walkthroughs/prompt-files", "/features/prompt-files"],
          },
          // TODO - actions redirects
          {
            to: "/advanced/deep-dives/slash-commands",
            from: [
              "/actions/how-to-use-it",
              "/actions/how-to-customize",
              "/actions",
              "/actions/model-setup",
              "/actions/context-selection",
              "/actions/how-it-works",
              "/customize/slash-commands",
              "/customization/slash-commands",
            ],
          },

          {
            to: "/advanced/deep-dives/vscode-actions",
            from: ["/walkthroughs/quick-actions"],
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
            to: "/advanced/context-integration/custom-providers",
            from: ["/customization/context-providers"],
          },
          {
            to: "/advanced/deep-dives/development-data",
            from: ["/development-data", "/customize/development-data"],
          },
          {
            to: "/advanced/context-integration/documentation",
            from: "/features/talk-to-your-docs",
          },
          {
            to: "/advanced/model-providers/anthropic",
            from: "/reference/Model Providers/anthropicllm",
          },
          {
            to: "/advanced/model-providers/azure",
            from: "/reference/Model Providers/azure",
          },
          {
            to: "/advanced/model-providers/bedrock",
            from: "/reference/Model Providers/bedrock",
          },
          {
            to: "/advanced/model-providers/deepseek",
            from: "/reference/Model Providers/deepseek",
          },
          {
            to: "/advanced/model-providers/anthropic",
            from: "/reference/Model Providers/freetrial",
          },
          {
            to: "/advanced/model-providers/gemini",
            from: "/reference/Model Providers/geminiapi",
          },
          {
            to: "/advanced/model-providers/mistral",
            from: "/reference/Model Providers/mistral",
          },
          {
            to: "/advanced/model-providers/ollama",
            from: "/reference/Model Providers/ollama",
          },
          {
            to: "/advanced/model-providers/openai",
            from: "/reference/Model Providers/openai",
          },
          {
            to: "/",
            from: "/intro",
          },
          {
            to: "/advanced/model-providers/more/cloudflare",
            from: "/reference/Model Providers/cloudflare",
          },
          {
            to: "/advanced/model-providers/more/cohere",
            from: "/reference/Model Providers/cohere",
          },
          {
            to: "/advanced/model-providers/more/deepinfra",
            from: "/reference/Model Providers/deepinfra",
          },
          {
            to: "/advanced/model-providers/more/flowise",
            from: "/reference/Model Providers/flowise",
          },
          {
            to: "/advanced/model-providers/more/huggingfaceinferenceapi",
            from: "/reference/Model Providers/huggingfaceinferenceapi",
          },
          {
            to: "/advanced/model-providers/more/ipex_llm",
            from: "/reference/Model Providers/ipex_llm",
          },
          {
            to: "/advanced/model-providers/more/kindo",
            from: "/reference/Model Providers/kindo",
          },
          {
            to: "/advanced/model-providers/more/llamacpp",
            from: "/reference/Model Providers/llamacpp",
          },
          {
            to: "/advanced/model-providers/more/llamafile",
            from: "/reference/Model Providers/llamafile",
          },
          {
            to: "/advanced/model-providers/more/lmstudio",
            from: "/reference/Model Providers/lmstudio",
          },
          {
            to: "/advanced/model-providers/more/msty",
            from: "/reference/Model Providers/msty",
          },
          {
            to: "/advanced/model-providers/more/openrouter",
            from: "/reference/Model Providers/openrouter",
          },
          {
            to: "/advanced/model-providers/more/replicatellm",
            from: "/reference/Model Providers/replicatellm",
          },
          {
            to: "/advanced/model-providers/more/sagemaker",
            from: "/reference/Model Providers/sagemaker",
          },
          {
            to: "/advanced/model-providers/more/textgenwebui",
            from: "/reference/Model Providers/textgenwebui",
          },
          {
            to: "/advanced/model-providers/more/together",
            from: "/reference/Model Providers/together",
          },
          {
            to: "/advanced/model-providers/more/novita",
            from: "/reference/Model Providers/novita",
          },
          {
            to: "/advanced/model-providers/more/vllm",
            from: "/reference/Model Providers/vllm",
          },
          {
            to: "/advanced/model-providers/more/watsonx",
            from: "/reference/Model Providers/watsonx",
          },
          {
            to: "/advanced/model-providers/more/nebius",
            from: "/reference/Model Providers/nebius",
          },
          // Sidebar items that should route directly to a subpage
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
            to: "/advanced/deep-dives/prompts",
            from: "/customize/deep-dives/prompt-files",
          },
          // Migrated from netlify.toml
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
            to: "/advanced/telemetry",
            from: "/telemetry",
          },
          {
            to: "/advanced/yaml-migration",
            from: "/yaml-migration",
          },
          {
            to: "/advanced/json-reference",
            from: "/json-reference",
          },
        ],
      },
    ],
  ],
};

module.exports = config;
