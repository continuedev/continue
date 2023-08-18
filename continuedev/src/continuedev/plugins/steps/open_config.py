from textwrap import dedent

from ...core.main import Step
from ...core.sdk import ContinueSDK
from ...libs.util.paths import getConfigFilePath


class OpenConfigStep(Step):
    name: str = "Open config"

    async def describe(self, models):
        return dedent(
            """\
            `\"config.py\"` is now open. You can add a custom slash command in the `\"custom_commands\"` section, like in this example:
            ```python
            config = ContinueConfig(
                ...
                custom_commands=[CustomCommand(
                    name="test",
                    description="Write unit tests like I do for the highlighted code",
                    prompt="Write a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated.",
                )]
            )
            ```
            `name` is the command you will type.
            `description` is the description displayed in the slash command menu.
            `prompt` is the instruction given to the model. The overall prompt becomes "Task: {prompt}, Additional info: {user_input}". For example, if you entered "/test exactly 5 assertions", the overall prompt would become "Task: Write a comprehensive...and sophisticated, Additional info: exactly 5 assertions"."""
        )

    async def run(self, sdk: ContinueSDK):
        await sdk.ide.setFileOpen(getConfigFilePath())
