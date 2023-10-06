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

### Answer coding questions

Highlight sections of code and ask Continue for another perspective

- “what does this forRoot() static function do in nestjs?”
- “why is the first left join in this query necessary here?”
- “how do I run a performance benchmark on this rust binary?”

### Edit in natural language

Highlight a section of code and instruct Continue to refactor it

- “/edit rewrite this to return a flattened list from a 3x3 matrix”
- “/edit refactor these into an angular flex layout on one line"
- “/edit define a type here for a list of lists of dictionaries”

### Generate files from scratch

Open a blank file and let Continue start new Python scripts, React components, etc.

- “/edit get me started with a basic supabase edge function”
- “/edit implement a c++ shortest path algo in a concise way”
- “/edit create a docker compose file with php and mysql server"

### Understand errors and exceptions

Press `cmd+shift+r` (MacOS) / `ctrl+shift+r` (Windows) when you come across an error or exception in your terminal. This will throw the stack trace into Continue and ask for it to explain the issue to you.

## Getting Started

### Download for [VS Code](https://marketplace.visualstudio.com/items?itemName=Continue.continue) and [JetBrains](https://plugins.jetbrains.com/plugin/22707-continue-extension)

By default, Continue uses `GPT-4` and `GPT-3.5-turbo` via the OpenAI API. You can adjust the config to use different Large Language Models (LLMs), including local, private models. Read more [here](https://continue.dev/docs/customization/models).

### [Run the server manually](https://continue.dev/docs/walkthroughs/manually-run-continue)

You might want to run Continue manually if (a) a firewall, VPN, or other issue is stopping Continue from automatically downloading the server binary, (b) you are on an OS where the binary fails to run (e.g. RHEL8), (c) you are using an air-gapped computer, (d) you want to self-host Continue, or (e) you want to run from source while developing / modifying Continue's code.

### [Run in "headless mode"](https://continue.dev/docs/walkthroughs/headless-mode)

"Headless mode" allows Continue to run in the background, without needing to be connected to the IDE or GUI. This is useful for performing refactors or other long-running tasks asynchronously. Headless mode can also be run in CI/CD, for example, to perform a thorough review for errors.

## Contributing

Check out the [contribution ideas board](https://github.com/orgs/continuedev/projects/2), read the [contributing guide](https://github.com/continuedev/continue/blob/main/CONTRIBUTING.md), and join [#contribute on Discord](https://discord.gg/vapESyrFmJ)

## License

[Apache 2.0 © 2023 Continue Dev, Inc.](./LICENSE)