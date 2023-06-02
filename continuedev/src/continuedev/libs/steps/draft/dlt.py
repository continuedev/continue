from textwrap import dedent

from ....core.sdk import Models

from ....core.observation import DictObservation
from ....models.filesystem_edit import AddFile
from ....core.main import Step
from ....core.sdk import ContinueSDK
from ..core.core import WaitForUserInputStep
from ..main import MessageStep


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
            f'dlt init {source_name} duckdb',
            'Y',
            'pip install -r requirements.txt'
        ])

        # editing the resource function to call the requested API
        await sdk.edit_file(
            filename=filename,
            prompt=f'Edit the resource function to call the API described by this: {self.api_description}'
        )

        # wait for user to put API key in secrets.toml
        await sdk.ide.setFileOpen(await sdk.ide.getWorkspaceDirectory() + "/.dlt/secrets.toml")
        await sdk.wait_for_user_confirmation("If this service requires an API key, please add it to the `secrets.toml` file and then press `Continue`")
        return DictObservation(values={"source_name": source_name})


class ValidatePipelineStep(Step):

    async def describe(self, models: Models):
        return dedent("""\
        This step will validate that your dlt pipeline is working as expected:
        - Test that the API call works
        - Load the data into a local DuckDB instance
        - Write a query to view the data
        """)

    async def run(self, sdk: ContinueSDK):
        source_name = sdk.history.last_observation().values["source_name"]
        filename = f'{source_name}.py'

        # test that the API call works
        await sdk.run(f'python3 {filename}')

        # remove exit() from the main main function
        await sdk.edit_file(
            filename=filename,
            prompt='Remove exit() from the main function'
        )

        # load the data into the DuckDB instance
        await sdk.run(f'python3 {filename}')

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
        await sdk.apply_filesystem_edit(AddFile(filepath=query_filename, content=tables_query_code))
        await sdk.run('env/bin/python3 query.py')


class CreatePipelineStep(Step):
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
            ValidatePipelineStep()
        )
