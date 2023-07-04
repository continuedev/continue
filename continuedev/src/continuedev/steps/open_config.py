from textwrap import dedent
from ..core.main import Step
from ..core.sdk import ContinueSDK
import os


class OpenConfigStep(Step):
    name: str = "Open config"

    async def describe(self, models):
        return dedent("""\
            Config.json is now open. You can add a custom slash command in the `\"custom_commands\"` section, like in this example:
            ```json
            "custom_commands": [
                {
                    "name": "test",
                    "prompt": "write me a comprehensive unit test for this function, that covers all edge cases. Use pytest."
                }
            ],
            ```""")

    async def run(self, sdk: ContinueSDK):
        global_dir = os.path.expanduser('~/.continue')
        config_path = os.path.join(global_dir, 'config.json')
        await sdk.ide.setFileOpen(config_path)
