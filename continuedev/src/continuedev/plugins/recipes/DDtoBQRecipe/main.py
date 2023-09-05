from textwrap import dedent

from ....core.main import Step
from ....core.sdk import ContinueSDK
from ....plugins.steps.core.core import MessageStep
from .steps import LoadDataStep, SetUpChessPipelineStep, SwitchDestinationStep

# Based on the following guide:
# https://github.com/dlt-hub/dlt/pull/392


class DDtoBQRecipe(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        await sdk.run_step(
            MessageStep(
                name="Move from using DuckDB to Google BigQuery as the destination",
                message=dedent(
                    """\
                This recipe will walk you through the process of moving from using DuckDB to Google BigQuery as the destination for your dlt pipeline. With the help of Continue, you will:
                - Set up a dlt pipeline for the chess.com API
                - Switch destination from DuckDB to Google BigQuery
                - Add BigQuery credentials to your secrets.toml file
                - Run the pipeline again to load data to BigQuery"""
                ),
            )
            >> SetUpChessPipelineStep()
            >> SwitchDestinationStep()
            >> LoadDataStep()
        )
