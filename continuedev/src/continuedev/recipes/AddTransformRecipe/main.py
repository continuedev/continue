from textwrap import dedent

from ...core.main import Step
from ...core.sdk import ContinueSDK
from ...steps.core.core import WaitForUserInputStep
from ...steps.main import MessageStep
from .steps import SetUpChessPipelineStep, AddTransformStep


class AddTransformRecipe(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        await sdk.run_step(
            MessageStep(message=dedent("""\
                This recipe will walk you through the process of adding a transform to a dlt pipeline that uses the chess.com API source. With the help of Continue, you will:
                - X
                - Y
                - Z""")) >>
            
            SetUpChessPipelineStep() >>
            WaitForUserInputStep(prompt="How do you want to transform the chess.com API data before loading it? For example, you could use the `python-chess` library to decode the moves or filter out certain games") >>
            AddTransformStep()
        )
