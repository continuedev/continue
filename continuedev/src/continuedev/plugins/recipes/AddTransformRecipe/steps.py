import os
from textwrap import dedent

from ....core.main import Step
from ....core.sdk import ContinueSDK, Models
from ....libs.util.paths import find_data_file
from ....plugins.steps.core.core import MessageStep

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
                "pip install pandas streamlit",  # Needed for the pipeline show step later
            ],
            name="Set up Python environment",
            description=dedent(
                """\
            - Create a Python virtual environment: `python3 -m venv .env`
            - Activate the virtual environment: `source .env/bin/activate`
            - Install dlt: `pip install dlt`
            - Create a new dlt pipeline called "chess" that loads data into a local DuckDB instance: `dlt init chess duckdb`
            - Install the Python dependencies for the pipeline: `pip install -r requirements.txt`"""
            ),
        )


class AddTransformStep(Step):
    hide: bool = True

    # e.g. "Use the `python-chess` library to decode the moves in the game data"
    transform_description: str

    async def run(self, sdk: ContinueSDK):
        source_name = "chess"
        filename = f"{source_name}_pipeline.py"
        abs_filepath = os.path.join(sdk.ide.workspace_directory, filename)

        # Open the file and highlight the function to be edited
        await sdk.ide.setFileOpen(abs_filepath)

        await sdk.run_step(
            MessageStep(
                message=dedent(
                    """\
                This step will customize your resource function with a transform of your choice:
                - Add a filter or map transformation depending on your request
                - Load the data into a local DuckDB instance
                - Open up a Streamlit app for you to view the data"""
                ),
                name="Write transformation function",
            )
        )

        with open(find_data_file("dlt_transform_docs.md")) as f:
            dlt_transform_docs = f.read()

        prompt = dedent(
            f"""\
            Task: Write a transform function using the description below and then use `add_map` or `add_filter` from the `dlt` library to attach it a resource.

            Description: {self.transform_description}

            Here are some docs pages that will help you better understand how to use `dlt`.
                          
            {dlt_transform_docs}"""
        )

        # edit the pipeline to add a transform function and attach it to a resource
        await sdk.edit_file(
            filename=filename,
            prompt=prompt,
            name=f"Writing transform function {AI_ASSISTED_STRING}",
        )

        await sdk.wait_for_user_confirmation(
            "Press Continue to confirm that the changes are okay before we run the pipeline."
        )

        # run the pipeline and load the data
        await sdk.run(
            f"python3 {filename}",
            name="Run the pipeline",
            description=f"Running `python3 {filename}` to load the data into a local DuckDB instance",
        )

        # run a streamlit app to show the data
        await sdk.run(
            f"dlt pipeline {source_name}_pipeline show",
            name="Show data in a Streamlit app",
            description=f"Running `dlt pipeline {source_name} show` to show the data in a Streamlit app, where you can view and play with the data.",
        )
