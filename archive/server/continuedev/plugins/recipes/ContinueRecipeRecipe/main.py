from textwrap import dedent

from ....core.main import Step
from ....core.sdk import ContinueSDK
from ....plugins.steps.main import EditHighlightedCodeStep


class ContinueStepStep(Step):
    name: str = "Write your own Continue Step."
    prompt: str

    async def run(self, sdk: ContinueSDK):
        await sdk.run_step(
            EditHighlightedCodeStep(
                user_input=dedent(
                    f"""\
        Here is an example of a Step that runs a command and then edits a file.

        ```python
        from ...core.main import Step
        from ...core.sdk import ContinueSDK

        class RunCommandAndEditFileStep(Step):
            name: str = "Run a command and then edit a file."
            command: str
            file_path: str
            prompt: str

            async def run(self, sdk: ContinueSDK):
                await sdk.run([command])
                await sdk.edit_file(filename=self.file_path, prompt=self.prompt)
        ```

        Please edit the code to write your own Step that does the following:

        {self.prompt}

        It should be a subclass of Step as above, implementing the `run` method, and using pydantic attributes to define the parameters.

        """
                )
            )
        )
