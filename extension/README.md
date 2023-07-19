# Continue

**[Continue](https://continue.dev/docs) is the open-source autopilot for software development—a [VS Code extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue) that brings the power of ChatGPT to your IDE**

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

Let Continue build the scaffolding of Python scripts, React components, and more
- “/edit here is a connector for postgres, now write one for kafka”
- “/edit make an IAM policy that creates a user with read-only access to S3”
- “/edit use this schema to write me a SQL query that gets recently churned users”

## OpenAI API Key

New users can try out Continue with GPT-4 using a proxy server that securely makes calls to OpenAI using our API key. Continue should just work the first time you install the extension in VS Code.

Once you are using Continue regularly though, you will need to add an OpenAI API key that has access to GPT-4 by following these steps:
1. Copy your API key from https://platform.openai.com/account/api-keys
2. Use the `cmd`+`,` (Mac) / `ctrl`+`,` (Windows) to open your VS Code settings 
3. Type "Continue" in the search bar
4. Click `Edit in settings.json` under **Continue: OpenAI_API_KEY" section**
5. Paste your API key as the value for "continue.OPENAI_API_KEY" in `settings.json`

## License

[Apache 2.0 © 2023 Continue Dev, Inc.](./LICENSE)