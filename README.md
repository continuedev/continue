![Continue logo](media/c_d.png)

<h1 align="center">Continue</h1>

<div align="center">

**[Continue](https://continue.dev/docs) is an open-source autopilot for [VS Code](https://marketplace.visualstudio.com/items?itemName=Continue.continue) and [JetBrains](https://plugins.jetbrains.com/plugin/22707-continue-extension)—the easiest way to code with any LLM**

</div>

<div align="center">

<a target="_blank" href="https://opensource.org/licenses/Apache-2.0" style="background:none">
    <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" style="height: 22px;" />
</a>
<a target="_blank" href="https://continue.dev/docs" style="background:none">
    <img src="https://img.shields.io/badge/continue_docs-%23BE1B55" style="height: 22px;" />
</a>
<a target="_blank" href="https://discord.gg/vapESyrFmJ" style="background:none">
    <img src="https://img.shields.io/badge/discord-join-continue.svg?labelColor=191937&color=6F6FF7&logo=discord" style="height: 22px;" />
</a>

<p></p>

![Editing With Continue](media/readme.gif)

</div>

## Task and tab autocomplete

### Answer coding questions

Highlight + select sections of code and ask Continue for another perspective

- “what does this forRoot() static function do in nestjs?”
- “why is the first left join in this query necessary here?”
- “how do I run a performance benchmark on this rust binary?”

### Edit in natural language

Highlight + select a section of code and instruct Continue to refactor it

- “/edit rewrite this to return a flattened list from a 3x3 matrix”
- “/edit refactor these into an angular flex layout on one line"
- “/edit define a type here for a list of lists of dictionaries”

### Generate files from scratch

Open a blank file and let Continue start new Python scripts, React components, etc.

- “/edit get me started with a basic supabase edge function”
- “/edit implement a c++ shortest path algo in a concise way”
- “/edit create a docker compose file with php and mysql server"

### And much more!

- Try out [experimental support for local tab autocomplete](https://continue.dev/docs/walkthroughs/tab-autocomplete) in VS Code
- Use [built-in context providers](https://continue.dev/docs/customization/context-providers#built-in-context-providers) or create your own [custom context providers](https://continue.dev/docs/customization/context-providers#building-your-own-context-provider)
- Use [built-in slash commands](https://arc.net/l/quote/zbhwfjmp) or create your own [custom slash commands](https://continue.dev/docs/customization/slash-commands#custom-slash-commands)

## Getting Started

#### Download for [VS Code](https://marketplace.visualstudio.com/items?itemName=Continue.continue) and [JetBrains](https://plugins.jetbrains.com/plugin/22707-continue-extension)

You can try out Continue for free using a proxy server that securely makes calls with our API key to models like GPT-4, Gemini Pro, and Phind CodeLlama via OpenAI, Google, and Together respectively.

Once you're ready to use your own API key or a different model / provider, press the `+` button in the bottom left to add a new model to your `config.json`. Learn more about the models and providers [here](https://continue.dev/docs/model-setup/overview).

## Contributing

Check out the [contribution ideas board](https://github.com/orgs/continuedev/projects/2), read the [contributing guide](https://github.com/continuedev/continue/blob/main/CONTRIBUTING.md), and join [#contribute on Discord](https://discord.gg/vapESyrFmJ)

## License

[Apache 2.0 © 2023 Continue Dev, Inc.](./LICENSE)
