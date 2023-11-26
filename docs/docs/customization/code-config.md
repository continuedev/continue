# Code Configuration

To allow added flexibility and eventually support an entire plugin ecosystem, Continue can be configured programmatically in a Python file, `~/.continue/config.py`.

Whenever Continue loads, it carries out the following steps:

1. Load `~/.continue/config.json`
2. Convert this into a `ContinueConfig` object
3. If `~/.continue/config.py` exists and has defined `modify_config` correctly, call `modify_config` with the `ContinueConfig` object to generate the final configuration

Defining a `modify_config` function allows you to make any final modifications to your initial `config.json`. Here's an example that cuts the temperature in half:

```python title="~/.continue/config.py"
from continuedev.core.config import ContinueConfig

def modify_config(config: ContinueConfig) -> ContinueConfig:
    config.completion_options.temperature /= 2
    return config
```
