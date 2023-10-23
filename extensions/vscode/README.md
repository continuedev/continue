> 🎁 **New! [Try out the new JetBrains extension (Alpha)](https://plugins.jetbrains.com/plugin/22707-continue-extension)**

![Continue logo](c_d.png)

<h1 align="center">Continue</h1>

<div align="center">

**[Continue](https://continue.dev/docs) is the open-source autopilot for software development—an IDE extension that brings the power of ChatGPT to [VS Code](https://marketplace.visualstudio.com/items?itemName=Continue.continue) and [JetBrains](https://plugins.jetbrains.com/plugin/22707-continue-extension)**

</div>

<div align="center">

<a target="_blank" href="https://opensource.org/licenses/Apache-2.0" style="background:none">
    <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" style="height: 36px;" />
</a>
<a target="_blank" href="https://continue.dev/docs" style="background:none">
    <img src="https://img.shields.io/badge/continue_docs-%23BE1B55" style="height: 36px;" />
</a>
<a target="_blank" href="https://discord.gg/vapESyrFmJ" style="background:none">
    <img src="https://img.shields.io/badge/discord-join-continue.svg?labelColor=191937&color=6F6FF7&logo=discord" style="height: 36px;" />
</a>

<p></p>

![Editing With Continue](readme.gif)

</div>

## Task, not tab, auto-complete

### Get possible explanations

Ask Continue about a part of your code to get another perspective

- “how can I set up a Prisma schema that cascades deletes?”
- “where in the page should I be making this request to the backend?”
- “how can I communicate between these iframes?”

### Edit in natural language

Highlight a section of code and instruct Continue to refactor it

- “/edit migrate this digital ocean terraform file into one that works for GCP”
- “/edit change this plot into a bar chart in this dashboard component”
- “/edit rewrite this function to be async”

### Generate files from scratch

Open a blank file and let Continue start new Python scripts, React components, etc.

- “/edit here is a connector for postgres, now write one for kafka”
- “/edit make an IAM policy that creates a user with read-only access to S3”
- “/edit use this schema to write me a SQL query that gets recently churned users”

## Getting Started

By default, Continue uses GPT-4 and GPT-3.5-turbo via the OpenAI API.

You can adjust the config to use different LLMs, including local, private models. Read more [here](https://continue.dev/docs/customization#change-the-default-llm).

To see the keyboard shortcuts offered by Continue, see the "Feature Contributions" tab above.

# Troubleshooting

The Continue VS Code extension is currently in beta. It will attempt to start the Continue Python server locally for you, but sometimes this will fail, causing the "Starting Continue server..." not to disappear, or other hangups. While we are working on fixes to all of these problems, read here for common solutions:

> [Troubleshooting Continue](https://continue.dev/docs/troubleshooting)

## License

[Apache 2.0 © 2023 Continue Dev, Inc.](./LICENSE)
