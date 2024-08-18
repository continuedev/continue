# Customizing the Chat Template

Most open-source models expect a specific chat format, for example llama2 and codellama expect the input to look like `"[INST] How do I write bubble sort in Rust? [/INST]"`. Continue will automatically attempt to detect the correct prompt format based on the `model`value that you provide, but if you are receiving nonsense responses, you can use the `template` property to explicitly set the format that you expect. The options are: `["llama2", "alpaca", "zephyr", "phind", "anthropic", "chatml", "openchat", "neural-chat", "none"]`.

If you want to create an entirely new chat template, this can be done in [config.ts](../tutorials/how-to-use-config-json#code-configuration) by defining a function and adding it to the `templateMessages` property of your `LLM`. Here is an example of `templateMessages` for the Alpaca/Vicuna format:

```typescript
function templateAlpacaMessages(msgs: ChatMessage[]): string {
  let prompt = "";

  if (msgs[0].role === "system") {
    prompt += `${msgs[0].content}\n`;
    msgs.pop(0);
  }

  prompt += "### Instruction:\n";
  for (let msg of msgs) {
    prompt += `${msg.content}\n`;
  }

  prompt += "### Response:\n";

  return prompt;
}
```

It can then be used like this:

```typescript title="~/.continue/config.ts"
function modifyConfig(config: Config): Config {
  const model = config.models.find(
    (model) => model.title === "My Alpaca Model",
  );
  if (model) {
    model.templateMessages = templateAlpacaMessages;
  }
  return config;
}
```

This exact function and a few other default implementations are available in [`core/llm/templates/chat.ts`](https://github.com/continuedev/continue/blob/main/core/llm/templates/chat.ts).
