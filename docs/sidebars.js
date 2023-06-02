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
    "create-a-recipe",
    {
      type: "category",
      label: "Concepts",
      items: [
        "concepts/autopilot",
        "concepts/core",
        "concepts/gui",
        "concepts/history",
        "concepts/ide",
        "concepts/llm",
        "concepts/policy",
        "concepts/recipes",
        "concepts/sdk",
        "concepts/step",
      ],
    },
  ],
};

module.exports = sidebars;
