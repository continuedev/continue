# Continue

**[Continue](https://continue.dev/docs) is the open-source autopilot for software development—a [VS Code extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue) that brings the power of ChatGPT to your IDE**

![Editing with Continue](https://github.com/continuedev/continue/blob/main/readme.gif?raw=true)

## Task, not tab, auto-complete

### Get possible explainations

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

### [Download for VS Code](https://marketplace.visualstudio.com/items?itemName=Continue.continue)

Continue requires that you have Python 3.8 or greater. If you do not, please [install](https://python.org) it

If your Continue server is not setting up, please check the console logs:

1. `cmd+shift+p` (MacOS) / `ctrl+shift+p` (Windows)
2. Search for and then select "Developer: Toggle Developer Tools"
3. Select `Console`
4. Read the console logs

# Troubleshooting

The Continue VS Code extension is currently in beta. It will attempt to start the Continue Python server locally for you, but sometimes this will fail, causing the "Starting Continue server..." not to disappear, or other hangups. While we are working on fixes to all of these problems, read here for common solutions:

> [Troubleshooting Continue](https://continue.dev/docs/troubleshooting)

## License

[Apache 2.0 © 2023 Continue Dev, Inc.](./LICENSE)
