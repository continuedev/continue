from ..core.main import Step
from ..core.sdk import ContinueSDK
import os


class OpenConfigStep(Step):
    name: str = "Open config"

    async def describe(self, models):
        return "Config.json is now open. Create a new or edit an existing slash command here. Here is an example: { custom_commands : [ { 'name;: 'test', 'prompt': 'write me a unit test' } ] }"

    async def run(self, sdk: ContinueSDK):
        global_dir = os.path.expanduser('~/.continue')
        config_path = os.path.join(global_dir, 'config.json')
        await sdk.ide.setFileOpen(config_path)