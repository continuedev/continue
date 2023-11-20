# Continue Configuration File Formats

On November 20, 2023, we migrated to using JSON as the primary config file format. If you previously used Continue, we will have attempted to automatically translate your existing config.py into a config.json file. If this fails, we will fallback to a default config.json. Your previous config.py will still be kept, but moved to config.py.old for reference. Below you can find a list of changes that were made in case you need to manually migrate your config.

The JSON format provides stronger guiderails, making it easier to write a valid config, while still allowing Intellisense in VS Code.

If you need any help migrating, please reach out to us on Discord.

## Configuration as Code

For configuration that requires code, we now provide a simpler interface that works alongside config.json. In the same folder, `~/.continue`, create a file named `config.py` (the same name as before) and add a function called `modify_config`. This function should take a `ContinueConfig` object as its only argument, and return a `ContinueConfig` object. This allows you to modify the initial configuration object defined in your `config.json`. Here's an example that cuts the temperature in half:

```python
from continuedev.core.config import ContinueConfig

def modify_config(config: ContinueConfig) -> ContinueConfig:
    config.completion_options.temperature /= 2
    return config
```

To summarize, these are the steps taken to load your configuration:

1. Load `~/.continue/config.json`
2. Convert this into a `ContinueConfig` object
3. If `~/.continue/config.py` exists and has defined `modify_config` correctly, call `modify_config` with the `ContinueConfig` object to generate the final configuration

## List of Changes

### `completion_options`

The properties `top_p`, `top_k`, `temperature`, `presence_penalty`, and `frequency_penalty` have been moved into a single object called `completion_options`. It can be specified at the top level of the config or within a `models` object.

### `request_options`

The properties `timeout`, `verify_ssl`, `ca_bundle_path`, `proxy`, and `headers` have been moved into a single object called `request_options`, which can be specified for each `models` object.

### The `model` property

Instead of writing something like `Ollama(model="phind-codellama:34b", ...)`, where the `model` property was different depending on the provider and had to be exactly correct, we now offer a default set of models, including the following:

```python
    # OpenAI
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
    "gpt-4",
    "gpt-3.5-turbo-0613",
    "gpt-4-32k",
    "gpt-4-1106-preview",
    # Open-Source
    "mistral-7b",
    "llama2-7b",
    "llama2-13b",
    "codellama-7b",
    "codellama-13b",
    "codellama-34b",
    "phind-codellama-34b",
    "wizardcoder-7b",
    "wizardcoder-13b",
    "wizardcoder-34b",
    "zephyr-7b",
    "codeup-13b",
    "deepseek-1b",
    "deepseek-7b",
    "deepseek-33b",
    # Anthropic
    "claude-2",
    # Google PaLM
    "chat-bison-001",
```

If you want to use a model not listed here, you can still do that by specifying whichever value of `model` you need. But if there's something you think we should add as a default, let us know!

### Prompt template auto-detection

Based on the `model` property, we now attempt to [autodetect](https://github.com/continuedev/continue/blob/108e00c7db9cad110c5df53bdd0436b286b92466/server/continuedev/core/config_utils/shared.py#L38) the prompt template. If you want to be explicit, you can select one of our prompt template types (`"llama2", "alpaca", "zephyr", "phind", "anthropic", "chatml", "deepseek"`) or write a custom prompt template in `config.py`.

### `PromptTemplate`

If you were previously using the `PromptTemplate` class in your `config.py` to write a custom template, we have moved it from `continuedev.libs.llm.base` to `continuedev.models.llm`.
