from ..core.main import Step
from ..core.sdk import ContinueSDK
import os


class OpenConfigStep(Step):
    name: str = "Open config"

    async def run(self, sdk: ContinueSDK):
        global_dir = os.path.expanduser('~/.continue')
        config_path = os.path.join(global_dir, 'config.json')
        print(config_path)
        await sdk.ide.setFileOpen(config_path)