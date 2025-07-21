# `cn` demo

```bash
cn
```

```bash
cn --rule nate/spanish
```

```bash
cn --rule continuedev/sentry-nextjs
```

```bash
cn -p "generate a commit msg for the current git diff. your output should be ONLY the commit message, nothing else"
```

GitHub workflow

```bash
cn remote
```

Please add a new slash command "/init" sends the following message to the model: "please generate an "AGENT.md" file at the root of this repository that includes basic information necessary to work in and understand it. Should include install, build, lint, test, run instructions and other important know-how / practices.

Watch a few updates.

Copy the URL

```bash
cn remote --resume <URL>
```

Queue a message: make sure to title the file with "Important agent context"

Show the dashboard at https://hub.continue.dev/agents

Explain that behind the scenes we are just running `cn serve` by running it locally

```bash
cn serve
```

and then connecting with

```bash
cn remote --resume http://localhost:8000
```
