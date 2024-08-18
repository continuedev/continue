# How to use config.json

Continue can be deeply customized by editing `config.json` and `config.ts` on your machine. You can find these files in the `~/.continue/` directory on MacOS and the `%userprofile%\.continue` directory on Windows. These files are created the first time you run Continue.

See the [config.json Reference](../reference/config) for the full list of configuration options.

If you'd like to share Continue configuration with others, you can add a `.continuerc.json` to the root of your project. It has the same JSON Schema definition as `config.json`, and will automatically be applied on top of the local `config.json`.

## Code Configuration

To allow added flexibility and eventually support an entire plugin ecosystem, Continue can be configured programmatically in a TypeScript file, `~/.continue/config.ts`.

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

## Customize System Message

You can write your own system message, a set of instructions that will always be top-of-mind for the LLM, by setting the `systemMessage` property to any string. For example, you might request "Please make all responses as concise as possible and never repeat something you have already explained."

System messages can also reference files. For example, if there is a markdown file (e.g. at `/Users/nate/Documents/docs/reference.md`) you'd like the LLM to know about, you can reference it with [Mustache](http://mustache.github.io/mustache.5.html) templating like this: "Please reference this documentation: \{\{ Users/nate/Documents/docs/reference.md \}\}". As of now, you must use an absolute path.

## Temperature

Set `temperature` to any value between 0 and 1. Higher values will make the LLM more creative, while lower values will make it more predictable. The default is 0.5.
