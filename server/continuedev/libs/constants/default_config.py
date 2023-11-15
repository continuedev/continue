default_config = """\
\"\"\"
config.py allows you to modify Continue programmatically instead of just using config.json.

First, config.json is loaded. Then, if you have defined modify_config here, the function will be given the result of
loading config.json, and will return the final ContinueConfig to be used.
\"\"\"

from continuedev.core.config import ContinueConfig

def modify_config(config: ContinueConfig) -> ContinueConfig:
    config.completion_options.temperature = 0.5
    return config

"""
