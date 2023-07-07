<h1 align="center">Continue</h1>

<div align="center">

**[Continue](https://continue.dev/docs) is the open-source autopilot for software development—a [VS Code extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue) that brings the power of ChatGPT to your IDE**

</div>

<div align="center">

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
![Twitter URL](https://img.shields.io/twitter/url?style=social&url=https%3A%2F%2Fgithub.com%2Fcontinuedev%2Fcontinue)
  <a target="_blank" href="https://discord.gg/vapESyrFmJ" style="background:none">
    <img src="https://img.shields.io/badge/discord-join-continue.svg?labelColor=191937&color=6F6FF7&logo=discord" />
  </a>

![Editing With Continue](edit.gif)
</div>

## Task, not tab, auto-complete

### Edit in natural language

Highlight a section of code and instruct Continue to refactor it
- `/edit Make this use more descriptive variable names`
- `/edit Rewrite this API call to grab all pages`
- `/edit Use 'Union' instead of a vertical bar here`

### Get possible explainations

Ask Continue about a part of your code to get another perspective
- `/explain what might cause this error?`
- `/explain what is the load_dotenv library name?`
- `/explain how do I find running process on port 8000?`

### Generate files from scratch

Let Continue build the scaffolding of Python scripts, React components, and more
- `Create a shell script to back up my home dir to /tmp/`
- `Write Python in a new file to get Posthog events`
- `Add a React component for syntax highlighted code`

## Getting Started

### [Download for VS Code](https://marketplace.visualstudio.com/items?itemName=Continue.continue)

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
