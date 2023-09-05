from textwrap import dedent

from ....core.main import Step
from ....core.sdk import ContinueSDK
from ....plugins.steps.core.core import MessageStep, WaitForUserInputStep
from .steps import AddTransformStep, SetUpChessPipelineStep


class AddTransformRecipe(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        text_observation = await sdk.run_step(
            MessageStep(
                message=dedent(
                    """\
                This recipe will walk you through the process of adding a transform to a dlt pipeline that uses the chess.com API source. With the help of Continue, you will:
                - Set up a dlt pipeline for the chess.com API
                - Add a filter or map transform to the pipeline
                - Run the pipeline and view the transformed data in a Streamlit app"""
                ),
                name="Add transformation to a dlt pipeline",
            )
            >> SetUpChessPipelineStep()
            >> WaitForUserInputStep(
                prompt="How do you want to transform the Chess.com API data before loading it? For example, you could filter out games that ended in a draw."
            )
        )
        await sdk.run_step(
            AddTransformStep(transform_description=text_observation.text)
        )
