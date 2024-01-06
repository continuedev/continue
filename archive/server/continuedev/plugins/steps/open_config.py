from textwrap import dedent

from ...core.main import Step
from ...core.sdk import ContinueSDK
from ...libs.util.paths import getConfigFilePath


class OpenConfigStep(Step):
    name: str = "Open config"
    hide = True

    async def describe(self, models):
        return dedent(
            'Read [the docs](https://continue.dev/docs/customization/overview) to learn more about how you can customize Continue using `"config.py"`.'
        )

    async def run(self, sdk: ContinueSDK):
        await sdk.ide.setFileOpen(getConfigFilePath(json=True))
