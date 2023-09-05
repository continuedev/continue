from textwrap import dedent
from typing import Coroutine

from ...core.main import Step
from ...core.observation import Observation
from ...core.sdk import ContinueSDK
from ...libs.util.strings import remove_quotes_and_escapes


class GenerateShellCommandStep(Step):
    user_input: str

    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        cmd = await sdk.models.default.complete(
            dedent(
                f"""\
            The user has made a request to run a shell command. Their description of what it should do is:
            
            "{self.user_input}"

            Please write a shell command that will do what the user requested. Your output should consist of only the command itself, without any explanation or example output. Do not use any newlines. Only output the command that when inserted into the terminal will do precisely what was requested.
            """
            )
        )

        cmd = remove_quotes_and_escapes(cmd.strip()).replace("\n", "").replace("\r", "")

        await sdk.ide.runCommand(cmd)

        self.description = f"Generated shell command: {cmd}"
