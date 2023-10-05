from textwrap import dedent

from ....core.main import Step
from ....core.sdk import ContinueSDK
from ....plugins.steps.core.core import MessageStep, WaitForUserInputStep
from .steps import RunQueryStep, SetupPipelineStep, ValidatePipelineStep


class CreatePipelineRecipe(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        text_observation = await sdk.run_step(
            MessageStep(
                name="Building your first dlt pipeline",
                message=dedent(
                    """\
                This recipe will walk you through the process of creating a dlt pipeline for your chosen data source. With the help of Continue, you will:
                - Create a Python virtual environment with dlt installed
                - Run `dlt init` to generate a pipeline template
                - Write the code to call the API
                - Add any required API keys to the `secrets.toml` file
                - Test that the API call works
                - Load the data into a local DuckDB instance
                - Write a query to view the data"""
                ),
            )
            >> WaitForUserInputStep(
                prompt="What API do you want to load data from? (e.g. weatherapi.com, chess.com)"
            )
        )
        await sdk.run_step(
            SetupPipelineStep(api_description=text_observation.text)
            >> ValidatePipelineStep()
            >> RunQueryStep()
            >> MessageStep(
                name="Congrats!",
                message="You've successfully created your first dlt pipeline! 🎉",
            )
        )
