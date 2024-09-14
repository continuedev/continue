// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const { themes } = require("prism-react-renderer");
const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Continue",
  tagline:
    "the open-source library for accelerating software development with language models",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://continue.dev",
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
    locales: ["en"],
  },

  themes: [["docusaurus-json-schema-plugin", {}]],

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl: "https://github.com/continuedev/continue/tree/main/docs",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
        gtag: {
          trackingID: "G-M3JWW8N2XQ",
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
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
            label: "Docs",
            href: "/docs",
          },
          {
            type: "docSidebar",
            sidebarId: "customizingSidebar",
            position: "left",
            label: "Customize",
            href: "/customize/overview",
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
      "@docusaurus/plugin-client-redirects",
      {
        redirects: [
          {
            to: "/customize/overview",
            from: "/customization",
          },
          {
            to: "/docs/getting-started/overview",
            from: "/model-setup/overview",
          },
          {
            to: "/docs/getting-started/overview",
            from: "/model-setup/select-model",
          },
          {
            to: "/docs/getting-started/overview",
            from: "/model-setup/configuration",
          },
          {
            to: "/customize/model-providers",
            from: "/setup/select-provider",
          },
          {
            to: "/customize/deep-dives/codebase",
            from: "/walkthroughs/codebase-embeddings",
          },
          {
            to: "/customize/deep-dives/autocomplete",
            from: "/walkthroughs/tab-autocomplete",
          },
          {
            to: "/customize/deep-dives/prompt-files",
            from: "/walkthroughs/prompt-files",
          },
          {
            to: "/docs/actions/how-to-use-it#quick-actions",
            from: "/walkthroughs/quick-actions",
          },
          {
            to: "/customize/changelog",
            from: "/changelog",
          },
          {
            to: "/customize/config",
            from: "/customization/code-config",
          },
          {
            to: "/customize/context-providers",
            from: "/customization/context-providers",
          },
          {
            to: "/customize/development-data",
            from: "/development-data",
          },
          {
            to: "/customize/deep-dives/autocomplete",
            from: "/features/tab-autocomplete",
          },
          {
            to: "/customize/deep-dives/codebase",
            from: "/features/codebase-embeddings",
          },
          {
            to: "/customize/deep-dives/docs",
            from: "/features/talk-to-your-docs",
          },
          {
            to: "/customize/deep-dives/prompt-files",
            from: "/features/prompt-files",
          },
          {
            to: "/customize/model-providers",
            from: "/setup/model-providers",
          },
          {
            to: "/customize/model-providers/anthropic",
            from: "/reference/Model%20Providers/anthropicllm",
          },
          {
            to: "/customize/model-providers/azure",
            from: "/reference/Model%20Providers/azure",
          },
          {
            to: "/customize/model-providers/bedrock",
            from: "/reference/Model%20Providers/bedrock",
          },
          {
            to: "/customize/model-providers/deepseek",
            from: "/reference/Model%20Providers/deepseek",
          },
          {
            to: "/customize/model-providers/free-trial",
            from: "/reference/Model%20Providers/freetrial",
          },
          {
            to: "/customize/model-providers/gemini",
            from: "/reference/Model%20Providers/geminiapi",
          },
          {
            to: "/customize/model-providers/mistral",
            from: "/reference/Model%20Providers/mistral",
          },
          {
            to: "/customize/model-providers/ollama",
            from: "/reference/Model%20Providers/ollama",
          },
          {
            to: "/customize/model-providers/openai",
            from: "/reference/Model%20Providers/openai",
          },
          {
            to: "/customize/overview",
            from: "/customization/overview",
          },
          {
            to: "/customize/slash-commands",
            from: "/customization/slash-commands",
          },
          {
            to: "/customize/tutorials/custom-code-rag",
            from: "/walkthroughs/custom-code-rag",
          },
          {
            to: "/customize/tutorials/llama3.1",
            from: "/walkthroughs/llama3.1",
          },
          {
            to: "/customize/tutorials/running-continue-without-internet",
            from: "/walkthroughs/running-continue-without-internet",
          },
          {
            to: "/customize/tutorials/set-up-codestral",
            from: "/walkthroughs/set-up-codestral",
          },
          {
            to: "/docs",
            from: "/intro",
          },
          {
            to: "/docs/getting-started/overview",
            from: "/quickstart",
          },
          {
            to: "/docs/telemetry",
            from: "/telemetry",
          },
          {
            to: "/docs/troubleshooting",
            from: "/troubleshooting",
          },
        ],
      },
    ],
  ],
};

module.exports = config;
