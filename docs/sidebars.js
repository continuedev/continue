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
    "intro",
    "getting-started",
    "install",
    "how-continue-works",
    {
      type: "category",
      label: "Walkthroughs",
      items: [
        "walkthroughs/use-the-gui",
        "walkthroughs/use-a-recipe",
        "walkthroughs/create-a-recipe",
        "walkthroughs/share-a-recipe",
      ],
    },
    {
      type: "category",
      label: "Concepts",
      items: [
        "concepts/autopilot",
        "concepts/server",
        "concepts/gui",
        "concepts/history",
        "concepts/ide",
        "concepts/llm",
        "concepts/policy",
        "concepts/recipe",
        "concepts/sdk",
        "concepts/step",
      ],
    },
    "telemetry",
  ],
};

module.exports = sidebars;
