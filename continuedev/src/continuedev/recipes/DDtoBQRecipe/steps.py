import os
import subprocess
from textwrap import dedent
import time

from ...models.main import Range
from ...models.filesystem import RangeInFile
from ...steps.main import MessageStep
from ...core.sdk import Models
from ...core.observation import DictObservation, InternalErrorObservation
from ...models.filesystem_edit import AddFile, FileEdit
from ...core.main import Step
from ...core.sdk import ContinueSDK

AI_ASSISTED_STRING = "(✨ AI-Assisted ✨)"

class SetUpChessPipelineStep(Step):
    hide: bool = True
    name: str = "Setup Chess.com API dlt Pipeline"

    async def describe(self, models: Models):
        return "This step will create a new dlt pipeline that loads data from the chess.com API."

    async def run(self, sdk: ContinueSDK):

        # running commands to get started when creating a new dlt pipeline
        await sdk.run([
            'python3 -m venv env',
            'source env/bin/activate',
            'pip install dlt',
            'dlt --non-interactive init chess duckdb',
            'pip install -r requirements.txt',
        ], name="Set up Python environment", description=dedent(f"""\
            Running the following commands:
            - `python3 -m venv env`: Create a Python virtual environment
            - `source env/bin/activate`: Activate the virtual environment
            - `pip install dlt`: Install dlt
            - `dlt init chess duckdb`: Create a new dlt pipeline called "chess" that loads data into a local DuckDB instance
            - `pip install -r requirements.txt`: Install the Python dependencies for the pipeline"""))


class SwitchDestinationStep(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):

        # Switch destination from DuckDB to Google BigQuery
        filename = 'chess.py'
        prompt = 'Replace the "destination" argument with "bigquery"'
        
        ## edit the pipeline to add a tranform function and attach it to a resource
        await sdk.edit_file(
            filename=filename,
            prompt=prompt,
            name=f'Replacing the "destination" argument with "bigquery"  {AI_ASSISTED_STRING}'
        )

        # Add BigQuery credentials to your secrets.toml file
        template = dedent(f"""\
            [destination.bigquery.credentials]
            location = "US"  # change the location of the data
            project_id = "project_id" # please set me up!
            private_key = "private_key" # please set me up!
            client_email = "client_email" # please set me up!""")

        ## wait for user to put API key in secrets.toml
        await sdk.ide.setFileOpen(await sdk.ide.getWorkspaceDirectory() + "/.dlt/secrets.toml")
        ## append template to bottom of secrets.toml
        await sdk.wait_for_user_confirmation("Please add your GCP credentials to `secrets.toml` file and then press `Continue`")

        # Run the pipeline again to load data to BigQuery
        output = await sdk.run('env/bin/python3 chess.py', name="Load data to BigQuery", description="Running `env/bin/python3 chess.py` to load data to Google BigQuery")

        ## TODO: REPLACE WITH APPROACH TO HELPING WITH THINGS MENTIONED IN `## 5. Troubleshoot exceptions`
        if "Traceback" in output or "SyntaxError" in output:
            suggestion = sdk.models.gpt35.complete(dedent(f"""\
                ```python
                {await sdk.ide.readFile(os.path.join(sdk.ide.workspace_directory, "query.py"))}
                ```
                This above code is a query that runs on the DuckDB instance. While attempting to run the query, the following error occurred:

                ```ascii
                {output}
                ```

                This is a brief summary of the error followed by a suggestion on how it can be fixed:"""))

            sdk.raise_exception(
                title="Error while running query", message=output, with_step=MessageStep(name=f"Suggestion to solve error {AI_ASSISTED_STRING}", message=suggestion)
            )
