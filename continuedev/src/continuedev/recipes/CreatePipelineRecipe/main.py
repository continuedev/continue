from textwrap import dedent

from ...core.main import Step
from ...core.sdk import ContinueSDK
from ...steps.core.core import WaitForUserInputStep
from ...steps.main import MessageStep
from .steps import SetupPipelineStep, ValidatePipelineStep


class CreatePipelineRecipe(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        await sdk.run_step(
            MessageStep(message=dedent("""\
                This recipe will walk you through the process of creating a dlt pipeline for your chosen data source. With the help of Continue, you will:
                - Create a Python virtual environment with dlt installed
                - Run `dlt init` to generate a pipeline template
                - Write the code to call the API
                - Add any required API keys to the `secrets.toml` file
                - Test that the API call works
                - Load the data into a local DuckDB instance
                - Write a query to view the data""")) >>
            WaitForUserInputStep(prompt="What API do you want to load data from?") >>
            SetupPipelineStep(api_description="WeatherAPI.com API") >>
            MessageStep(message=dedent("""\
                This step will validate that your dlt pipeline is working as expected:
                - Test that the API call works
                - Load the data into a local DuckDB instance
                - Write a query to view the data
                """)) >>
            ValidatePipelineStep()
        )
