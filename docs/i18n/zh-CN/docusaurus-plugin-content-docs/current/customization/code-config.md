# Code Configuration

To allow added flexibility and eventually support an entire plugin ecosystem, Continue can be configured programmatically in a Python file, `~/.continue/config.ts`.

Whenever Continue loads, it carries out the following steps:

1. Load `~/.continue/config.json`
2. Convert this into a `Config` object
3. If `~/.continue/config.ts` exists and has defined `modifyConfig` correctly, call `modifyConfig` with the `Config` object to generate the final configuration

Defining a `modifyConfig` function allows you to make any final modifications to your initial `config.json`. Here's an example that sets the temperature to a random number and maxTokens to 1024:

```typescript title="~/.continue/config.ts"
export function modifyConfig(config: Config): Config {
  config.completionOptions = {
    ...config.completionOptions,
    temperature: Math.random(),
    maxTokens: 1024,
  };
  return config;
}
```
