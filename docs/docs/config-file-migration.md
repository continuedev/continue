# New Config Format: `config.json`

On November 15, 2023, we migrated to using JSON as the primary config file format. If you previously used Continue, we will have attempted to automatically translate your existing config.py into a config.json file. If this fails, we will fallback to a default config.json.

The JSON format provides stronger guiderails, making it easier to write a valid config, while still allowing Intellisense in VS Code.

If you need any help migrating, please reach out to us on [Discord](https://discord.gg/Y83xkG3uUW).

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
