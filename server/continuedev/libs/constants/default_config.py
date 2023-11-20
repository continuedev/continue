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

default_config_json = """\
{
  "models": [
    {
      "title": "GPT-4",
      "provider": "openai-free-trial",
      "model": "gpt-4"
    },
    {
      "title": "GPT-3.5-Turbo",
      "provider": "openai-free-trial",
      "model": "gpt-3.5-turbo"
    }
  ],
  "model_roles": {
    "default": "GPT-4",
    "summarize": "GPT-3.5-Turbo"
  },
  "slash_commands": [
    {
      "name": "edit",
      "description": "Edit highlighted code",
      "step": "EditHighlightedCodeStep"
    },
    {
      "name": "config",
      "description": "Customize Continue",
      "step": "OpenConfigStep"
    },
    {
      "name": "comment",
      "description": "Write comments for the highlighted code",
      "step": "CommentCodeStep"
    },
    {
      "name": "share",
      "description": "Download and share this session",
      "step": "ShareSessionStep"
    },
    {
      "name": "cmd",
      "description": "Generate a shell command",
      "step": "GenerateShellCommandStep"
    }
  ],
  "custom_commands": [
    {
      "name": "test",
      "prompt": "Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
      "description": "Write unit tests for highlighted code"
    }
  ]
}
"""
