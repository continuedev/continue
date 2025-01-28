# VSCode CoPilot

VSCode LLM via CoPilot extension. Requires [GitHub CoPilot extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) and logged in.

## Models

Your access to advanced model may vary, especially for `o1`-level models.

Last updated as of Jan 28 2025:

- `copilot/gpt-3.5-turbo`
- `copilot/gpt-4`
- `copilot/gpt-4o`
- `copilot/gpt-4o-mini`
- `copilot/o1-mini`
- `copilot/o1-ga`
- `copilot/claude-3.5-sonnet` (Requires [opt-in](https://github.com/settings/copilot))

1. Install [GitHub CoPilot extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot).
2. Login and get a working subscription.
3. Update your Continue config file:

```json title="config.json"
{
  "models": [
    {
      "title": "VSCode LM",
      "provider": "vscode-lm",
      "model": "copilot/gpt-4o",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```
