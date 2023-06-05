from textwrap import dedent

from ...core.main import Step
from ...core.sdk import ContinueSDK
from ...steps.core.core import WaitForUserInputStep
from ...steps.main import MessageStep
from .steps import SetupPipelineStep, ValidatePipelineStep


class AddTransformRecipe(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        await sdk.run_step(
            MessageStep(message=dedent("""\
                This recipe will walk you through the process of adding a transform to a dlt pipeline for your chosen data source. With the help of Continue, you will:
                - X
                - Y
                - Z""")) >>
            WaitForUserInputStep(prompt="What API do you want to load data from?") >>
            SetupPipelineStep(api_description="WeatherAPI.com API") >>
            ValidatePipelineStep()
        )
