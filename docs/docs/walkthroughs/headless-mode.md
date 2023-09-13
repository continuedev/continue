# Completing Tasks Asynchronously with Headless Mode

"Headless mode" allows Continue to run in the background, without needing to be connected to the IDE or GUI. This is useful for performing refactors or other tasks that might take time to complete. Headless mode can also be run in CI/CD for example to perform a thorough review for errors.

To use headless mode:

1. `pip install continuedev` (using a virtual environment is recommended)
2. Create a config file (see the [`ContinueConfig` Reference](../reference/config.md) for all options) that includes the [Policy](../customization/other-configuration.md#custom-policies) you want to run
3. Import `continuedev` and call `start_headless_session` with either the path to your config file, or an instance of `ContinueConfig`

Example:

```python
from continuedev.headless import start_headless_session
from continuedev.core.config import ContinueConfig
from continuedev.core.models import Models
import asyncio

config = ContinueConfig(
    models=Models(...),
    override_policy=MyPolicy()
)
asyncio.run(start_headless_session(config))

# Alternatively, pass the path to a config file
asyncio.run(start_headless_session("/path/to/config.py"))
```
