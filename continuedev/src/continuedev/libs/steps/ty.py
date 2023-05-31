import subprocess
from ...models.main import Position, Range
from ...models.filesystem import RangeInFile
from ...models.filesystem_edit import AddDirectory, AddFile, FileEdit
from ...core.observation import DictObservation
from ...core.main import History, Step, Policy
from ...core.sdk import ContinueSDK
from .main import RunCommandStep
from ..steps.core.core import EditCodeStep, WaitForUserConfirmationStep, WaitForUserInputStep

source_name = "weather_api"


class SetupPipelineStep(Step):

    name = "Setup Pipeline"

    api_description: str  # e.g. "I want to load data from the weatherapi.com API"

    async def run(self, sdk: ContinueSDK):
        # source_name = (await sdk.models.gpt35()).complete(
        #     f"Write a snake_case name for the data source described by {self.api_description}: ").strip()
        filename = f'/Users/natesesti/Desktop/continue/extension/examples/python/{source_name}.py'

        # running commands to get started when creating a new dlt pipeline
        process = subprocess.Popen(
            '/bin/bash', stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        out, err = process.communicate(f'''
        cd /Users/natesesti/Desktop/continue/extension/examples/python && python3 -m venv env && source env/bin/activate && pip install dlt && dlt init {source_name} duckdb
Y
pip install -r requirements.txt && pip install dlt[duckdb]'''.encode())
        process = subprocess.Popen(
            '/bin/bash', stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        out, err = process.communicate(
            f'''cd /Users/natesesti/Desktop/continue/extension/examples/python && source env/bin/activate && pip install -r requirements.txt'''.encode())
        # await sdk.run_step(
        #     RunCommandStep(cmd="cd /Users/natesesti/Desktop/continue/extension/examples/python") >>
        #     RunCommandStep(cmd=f'python3 -m venv env') >>
        #     RunCommandStep(cmd=f'source env/bin/activate') >>
        #     RunCommandStep(cmd=f'pip install dlt') >>
        #     RunCommandStep(cmd=f'dlt init {source_name} duckdb') >>
        #     RunCommandStep(cmd=f'pip install -r requirements')
        # )

        # editing the resource function to call the requested API
        await sdk.ide.setFileOpen(filename)
        contents = await sdk.ide.readFile(filename)
        await sdk.run_step(EditCodeStep(
            range_in_files=[RangeInFile.from_entire_file(filename, contents)],
            prompt=f'{{code}}\n\nRewrite the entire file, editing the resource function to call the API described by this: {self.api_description}'
        ))

        # wait for user to put API key in secrets.toml
        await sdk.ide.setFileOpen("/Users/natesesti/Desktop/continue/extension/examples/python/.dlt/secrets.toml")
        await sdk.run_step(WaitForUserConfirmationStep(prompt=f"Please add the API key to the `secrets.toml` file and then press `Continue`"))
        return DictObservation(values={"source_name": source_name})


class ValidatePipelineStep(Step):

    name = "Validate Pipeline"

    async def run(self, sdk: ContinueSDK):
        # source_name = sdk.history.last_observation()["source_name"]
        filename = f'/Users/natesesti/Desktop/continue/extension/examples/python/{source_name}.py'

        # test that the API call works
        await sdk.run_step(RunCommandStep(cmd=f'env/bin/python3 weather_api.py'))
        # TODO: validate that the response code is 200 (i.e. successful) else loop

        # remove exit() from the main main function
        await sdk.ide.setFileOpen(filename)
        contents = await sdk.ide.readFile(filename)
        new_contents = contents.replace('exit()', '')
        await sdk.apply_filesystem_edit(FileEdit(filepath=filename, range=Range.from_entire_file(contents), replacement=new_contents))
        await sdk.ide.saveFile(filename)
        # await sdk.run_step(EditCodeStep(
        #     range_in_files=[RangeInFile.from_entire_file(filename)],
        #     prompt=f'Remove exit() from the main function'
        # ))

        # test that dlt loads the data into the DuckDB instance
        await sdk.run_step(RunCommandStep(cmd=f'env/bin/python3 weather_api.py'))
        # TODO: validate that `dlt` outputted success via print(load_info) else loop

        # write Python code in `query.py` that queries the DuckDB instance to validate it worked
        query_filename = '/Users/natesesti/Desktop/continue/extension/examples/python/query.py'

        names_query_code = '''
        import duckdb

        # Connect to the DuckDB instance
        con = duckdb.connect('weather.duckdb')

        # Query the schema_name.table_name
        result = conn.execute("SELECT table_schema || '.' || table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog')").fetchall()

        # Print the schema_name.table_name(s) to stdout
        for r in result:
            print(r[0])
        '''
        # await sdk.apply_filesystem_edit(FileEdit.from_insertion(
        #     filepath=query_filename,
        #     position=Position(line=0, character=0),
        #     content=names_query_code
        # ))
        # await sdk.run_step(RunCommandStep(cmd=f'env/bin/python3 query.py'))
        # TODO: replace with code that grabs all non-dlt `schema_name.table_name`s outputted by previous query
        table_name = "weather_api.weather_api_resource"
        tables_query_code = f'''
import duckdb

# connect to DuckDB instance
conn = duckdb.connect(database="weather.duckdb")

# get table names
rows = conn.execute("SELECT * FROM {table_name};").fetchall()

# print table names
for row in rows:
    print(row)
        '''
        await sdk.apply_filesystem_edit(AddFile(filepath=query_filename, content=tables_query_code))
        await sdk.ide.setFileOpen(query_filename)
        # await sdk.apply_filesystem_edit(FileEdit(filepath=query_filename, replacement=tables_query_code,
        #                                          range=Range.from_entire_file(content=names_query_code)))
        await sdk.run_step(RunCommandStep(cmd=f'env/bin/python3 query.py'))


class CreatePipelinePolicy(Policy):

    _current_state: str = "init"

    def next(self, history: History = History.from_empty()) -> "Step":
        if self._current_state == "init":
            self._current_state = "setup"
            return WaitForUserInputStep(prompt="What API do you want to load data from?")
        elif self._current_state == "setup":
            self._current_state = "validate"
            return SetupPipelineStep()
        elif self._current_state == "validate":
            self._current_state = "done"
            return ValidatePipelineStep()
        else:
            return None


class CreatePipelineStep(Step):

    async def run(self, sdk: ContinueSDK):
        await sdk.run_step(
            WaitForUserInputStep(prompt="What API do you want to load data from?") >>
            SetupPipelineStep(api_description="Load data from the WeatherAPI.com API") >>
            ValidatePipelineStep()
        )
