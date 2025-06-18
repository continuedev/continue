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
        gtag: {
          trackingID: "G-M3JWW8N2XQ",
        },
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
            label: "User Guide",
            href: "/",
          },
          {
            type: "docSidebar",
            sidebarId: "hubSidebar",
            position: "left",
            label: "Hub",
            href: "/hub/introduction",
          },
          {
            type: "docSidebar",
            sidebarId: "customizingSidebar",
            position: "left",
            label: "Customize",
            href: "/customize/overview",
          },
          {
            type: "docSidebar",
            sidebarId: "customizingSidebar",
            position: "left",
            label: "Reference",
            href: "/reference",
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
      "@docusaurus/plugin-client-redirects",
      {
        redirects: [
          // ... existing redirects ...
          {
            to: "/customize/deep-dives/prompts",
            from: ["/walkthroughs/prompt-files", "/features/prompt-files"],
          },
          {
            to: "/customize/model-providers/more/cloudflare",
            from: "/reference/Model Providers/cloudflare",
          },
        ],
      },
    ],
    [
      "posthog-docusaurus",
      {
        apiKey: process.env.POSTHOG_API_KEY || "DEV", // Fallback for development
        appUrl: "https://us.i.posthog.com",
        enableInDevelopment: false,
      },
    ],
  ],
};

module.exports = config;
