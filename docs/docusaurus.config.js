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
  baseUrl: "/docs",

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
      image: "img/continue-social-card.png",
      navbar: {
        title: "Continue",
        logo: {
          alt: "Continue Logo",
          src: "img/logo.png",
          href: "https://continue.dev",
        },
        items: [
          {
            type: "docSidebar",
            sidebarId: "docsSidebar",
            position: "left",
            label: "Docs",
          },
          {
            href: "https://github.com/continuedev/continue",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "Docs",
            items: [
              {
                label: "Introduction",
                to: "/intro",
              },
              {
                label: "VS Code",
                to: "https://marketplace.visualstudio.com/items?itemName=Continue.continue",
              },
            ],
          },
          {
            title: "Community",
            items: [
              {
                label: "Discord",
                href: "https://discord.gg/vapESyrFmJ",
              },
              {
                label: "Twitter",
                href: "https://twitter.com/continuedev",
              },
            ],
          },
          {
            title: "More",
            items: [
              {
                label: "GitHub",
                href: "https://github.com/continuedev/continue",
              },
              {
                label: "Website",
                href: "https://continue.dev",
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
          // Redirects from old docs
          {
            from: "/customization",
            to: "/customization/overview",
          },
          {
            from: "/getting-started",
            to: "/quickstart",
          },
        ],
      },
    ],
  ],
};

module.exports = config;
