import os
import subprocess
from textwrap import dedent

from ...models.main import Range
from ...models.filesystem import RangeInFile
from ...steps.main import MessageStep
from ...core.sdk import Models
from ...core.observation import DictObservation, InternalErrorObservation
from ...models.filesystem_edit import AddFile
from ...core.main import Step
from ...core.sdk import ContinueSDK


class SetupPipelineStep(Step):
    hide: bool = True
    name: str = "Setup dlt Pipeline"

    api_description: str  # e.g. "I want to load data from the weatherapi.com API"

    async def describe(self, models: Models):
        return dedent(f"""\
        This step will create a new dlt pipeline that loads data from an API, as per your request:
        {self.api_description}
        """)

    async def run(self, sdk: ContinueSDK):
        source_name = (await sdk.models.gpt35()).complete(
            f"Write a snake_case name for the data source described by {self.api_description}: ").strip()
        filename = f'{source_name}.py'

        # running commands to get started when creating a new dlt pipeline
        await sdk.run([
            'python3 -m venv env',
            'source env/bin/activate',
            'pip install dlt',
            f'dlt init {source_name} duckdb\n\rY',
            'pip install -r requirements.txt'
        ], description=dedent(f"""\
            Running the following commands:
            - `python3 -m venv env`: Create a Python virtual environment
            - `source env/bin/activate`: Activate the virtual environment
            - `pip install dlt`: Install dlt
            - `dlt init {source_name} duckdb`: Create a new dlt pipeline called {source_name} that loads data into a local DuckDB instance
            - `pip install -r requirements.txt`: Install the Python dependencies for the pipeline"""), name="Setup Python environment")

        # editing the resource function to call the requested API
        await sdk.ide.highlightCode(RangeInFile(filepath=os.path.join(await sdk.ide.getWorkspaceDirectory(), filename), range=Range.from_shorthand(15, 0, 30, 0)), "#00ff0022")

        await sdk.edit_file(
            filename=filename,
            prompt=f'Edit the resource function to call the API described by this: {self.api_description}',
            name="Edit the resource function to call the API"
        )

        # wait for user to put API key in secrets.toml
        await sdk.ide.setFileOpen(await sdk.ide.getWorkspaceDirectory() + "/.dlt/secrets.toml")
        await sdk.wait_for_user_confirmation("If this service requires an API key, please add it to the `secrets.toml` file and then press `Continue`")

        sdk.context.set("source_name", source_name)


class ValidatePipelineStep(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        workspace_dir = await sdk.ide.getWorkspaceDirectory()
        source_name = sdk.context.get("source_name")
        filename = f'{source_name}.py'

        # await sdk.run_step(MessageStep(name="Validate the pipeline", message=dedent("""\
        #         Next, we will validate that your dlt pipeline is working as expected:
        #         - Test that the API call works
        #         - Load the data into a local DuckDB instance
        #         - Write a query to view the data
        #         """)))

        # test that the API call works
        output = await sdk.run(f'python3 {filename}', name="Test the pipeline", description=f"Running python3 {filename} to test loading data from the API")

        # If it fails, return the error
        if "Traceback" in output:
            sdk.raise_exception(
                title="Error while running pipeline.\nFix the resource function in {filename} and rerun this step", description=output)

        # remove exit() from the main main function
        await sdk.edit_file(
            filename=filename,
            prompt='Remove exit() from the main function',
            name="Remove early exit() from main function",
            description="Remove the `exit()` call from the main function in the pipeline file so that the data is loaded into DuckDB"
        )

        # load the data into the DuckDB instance
        await sdk.run(f'python3 {filename}', name="Load data into DuckDB", description=f"Running python3 {filename} to load data into DuckDB")

        table_name = f"{source_name}.{source_name}_resource"
        tables_query_code = dedent(f'''\
            import duckdb

            # connect to DuckDB instance
            conn = duckdb.connect(database="{source_name}.duckdb")

            # get table names
            rows = conn.execute("SELECT * FROM {table_name};").fetchall()

            # print table names
            for row in rows:
                print(row)
        ''')

        query_filename = (await sdk.ide.getWorkspaceDirectory()) + "/query.py"
        await sdk.apply_filesystem_edit(AddFile(filepath=query_filename, content=tables_query_code), name="Add query.py file", description="Adding a file called `query.py` to the workspace that will run a test query on the DuckDB instance")
        await sdk.run('env/bin/python3 query.py', name="Run test query", description="Running `env/bin/python3 query.py` to test that the data was loaded into DuckDB as expected")
