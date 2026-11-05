<div align="center">

![Continued logo](media/readme.png)

<h1 align="center">Continued</h1>

**An open-source AI code agent for VS Code: agent, chat, edit and autocomplete with the models you choose.**

<a target="_blank" href="https://opensource.org/licenses/Apache-2.0" style="background:none">
    <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" style="height: 22px;" />
</a>

</div>

> **Unofficial, community-maintained fork.** Continued is not affiliated with, endorsed by, or supported by Continue Dev, Inc.

## Features

- **Agent**: hand it a development task; it reads and edits files and runs tools, asking before anything risky.
- **Chat**: ask about your code, with files, folders and other context attached.
- **Edit**: change the selected code in place, reviewing the diff before you accept it.
- **Autocomplete**: inline suggestions as you type, from a local or hosted model.

## What this fork adds

- **Amazon Bedrock**: one model list across the standard Bedrock endpoint and the Mantle endpoint.
- **Live model lists**: after **Test connection**, the model picker shows the models your account can use, newest first.
- **Current models**: up-to-date lists and limits for Anthropic, OpenAI, Gemini and Bedrock.
- **Sturdier streaming**: a dropped connection is retried before the reply starts, and a reply that is cut off says so.

## Install and set up

Continued is installed from a `.vsix` file. Downloads, checksums and troubleshooting are in the
[install guide](https://github.com/b1tninja/continued/blob/main/docs/continued-install.md).
Source and issues: [github.com/b1tninja/continued](https://github.com/b1tninja/continued).

## License

Apache 2.0. The original work is © 2023–2026 Continue Dev, Inc. Changes in this fork are © 2026 b1tninja.
See [LICENSE](./LICENSE.txt). This fork is not endorsed by or affiliated with Continue Dev, Inc.
