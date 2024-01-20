from textwrap import dedent

from ...core.main import Step
from ...core.sdk import ContinueSDK
from ...libs.util.paths import get_config_file_path


class OpenConfigStep(Step):
    name: str = "Open config"
    hide = True

    async def describe(self, models):
        return dedent(
            'Read [the docs](https://continue.dev/docs/customization/overview) to learn more about how you can customize Continue using `"config.py"`.',
        )

    async def run(self, sdk: ContinueSDK) -> None:
        await sdk.ide.setFileOpen(get_config_file_path(json=True))
