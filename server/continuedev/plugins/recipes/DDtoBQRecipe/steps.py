import os
from textwrap import dedent

from ....core.main import Step
from ....core.sdk import ContinueSDK, Models
from ....libs.util.paths import find_data_file
from ....plugins.steps.core.core import MessageStep
from ....plugins.steps.find_and_replace import FindAndReplaceStep

AI_ASSISTED_STRING = "(✨ AI-Assisted ✨)"


class SetUpChessPipelineStep(Step):
    hide: bool = True
    name: str = "Setup Chess.com API dlt Pipeline"

    async def describe(self, models: Models):
        return "This step will create a new dlt pipeline that loads data from the chess.com API."

    async def run(self, sdk: ContinueSDK):
        # running commands to get started when creating a new dlt pipeline
        await sdk.run(
            [
                "python3 -m venv .env",
                "source .env/bin/activate",
                "pip install dlt",
                "dlt --non-interactive init chess duckdb",
                "pip install -r requirements.txt",
            ],
            name="Set up Python environment",
            description=dedent(
                """\
            Running the following commands:
            - `python3 -m venv .env`: Create a Python virtual environment
            - `source .env/bin/activate`: Activate the virtual environment
            - `pip install dlt`: Install dlt
            - `dlt init chess duckdb`: Create a new dlt pipeline called "chess" that loads data into a local DuckDB instance
            - `pip install -r requirements.txt`: Install the Python dependencies for the pipeline"""
            ),
        )


class SwitchDestinationStep(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        # Switch destination from DuckDB to Google BigQuery
        filepath = os.path.join(sdk.ide.workspace_directory, "chess_pipeline.py")
        await sdk.run_step(
            FindAndReplaceStep(
                filepath=filepath,
                pattern="destination='duckdb'",
                replacement="destination='bigquery'",
            )
        )

        # Add BigQuery credentials to your secrets.toml file
        template = dedent(
            """\
            [destination.bigquery.credentials]
            location = "US"  # change the location of the data
            project_id = "project_id" # please set me up!
            private_key = "private_key" # please set me up!
            client_email = "client_email" # please set me up!"""
        )

        # wait for user to put API key in secrets.toml
        secrets_path = os.path.join(sdk.ide.workspace_directory, ".dlt/secrets.toml")
        await sdk.ide.setFileOpen(secrets_path)
        await sdk.append_to_file(secrets_path, template)

        # append template to bottom of secrets.toml
        await sdk.wait_for_user_confirmation(
            "Please add your GCP credentials to `secrets.toml` file and then press `Continue`"
        )


class LoadDataStep(Step):
    name: str = "Load data to BigQuery"
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        # Run the pipeline again to load data to BigQuery
        output = await sdk.run(
            ".env/bin/python3 chess_pipeline.py",
            name="Load data to BigQuery",
            description="Running `.env/bin/python3 chess_pipeline.py` to load data to Google BigQuery",
        )

        if "Traceback" in output or "SyntaxError" in output:
            with open(find_data_file("dlt_duckdb_to_bigquery_docs.md"), "r") as f:
                docs = f.read()

            output = "Traceback" + output.split("Traceback")[-1]
            suggestion = await sdk.models.default.complete(
                dedent(
                    f"""\
                When trying to load data into BigQuery, the following error occurred:

                ```ascii
                {output}
                ```

                Here is documentation describing common errors and their causes/solutions:

                {docs}

                This is a brief summary of the error followed by a suggestion on how it can be fixed:"""
                )
            )

            sdk.raise_exception(
                title="Error while running query",
                message=output,
                with_step=MessageStep(
                    name=f"Suggestion to solve error {AI_ASSISTED_STRING}",
                    message=suggestion,
                ),
            )
