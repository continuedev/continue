# FreeTrial

With the `FreeTrial` provider, new users can try out Continue with GPT-4 using a proxy server that securely makes calls to OpenAI using our API key. Continue should just work the first time you install the extension in VS Code.

Once you are using Continue regularly though, you will need to add an OpenAI API key that has access to GPT-4 by following these steps:

1. Copy your API key from https://platform.openai.com/account/api-keys
2. Open `~/.continue/config.json`. You can do this by using the '/config' command in Continue
3. Change the LLM to look like this:

```json title="~/.continue/config.json"
{
  "models": [
    {
      "title": "GPT-4",
      "provider": "openai",
      "model": "gpt-4",
      "apiKey": "YOUR_API_KEY"
    }
  ]
}
```

[View the source](https://github.com/continuedev/continue/blob/main/core/llm/llms/FreeTrial.ts)
