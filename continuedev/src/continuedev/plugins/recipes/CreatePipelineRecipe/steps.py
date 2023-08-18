import os
import time
from textwrap import dedent

from ....core.main import Step
from ....core.sdk import ContinueSDK, Models
from ....models.filesystem import RangeInFile
from ....models.filesystem_edit import AddFile, FileEdit
from ....models.main import Range
from ....plugins.steps.core.core import MessageStep

AI_ASSISTED_STRING = "(✨ AI-Assisted ✨)"


class SetupPipelineStep(Step):
    hide: bool = True
    name: str = "Setup dlt Pipeline"

    api_description: str  # e.g. "I want to load data from the weatherapi.com API"

    async def describe(self, models: Models):
        return dedent(
            f"""\
        This step will create a new dlt pipeline that loads data from an API, as per your request:
        {self.api_description}
        """
        )

    async def run(self, sdk: ContinueSDK):
        sdk.context.set("api_description", self.api_description)

        source_name = (
            await sdk.models.medium.complete(
                f"Write a snake_case name for the data source described by {self.api_description}: "
            )
        ).strip()
        filename = f"{source_name}.py"

        # running commands to get started when creating a new dlt pipeline
        await sdk.run(
            [
                "python3 -m venv .env",
                "source .env/bin/activate",
                "pip install dlt",
                f"dlt --non-interactive init {source_name} duckdb",
                "pip install -r requirements.txt",
            ],
            description=dedent(
                f"""\
            Running the following commands:
            - `python3 -m venv .env`: Create a Python virtual environment
            - `source .env/bin/activate`: Activate the virtual environment
            - `pip install dlt`: Install dlt
            - `dlt init {source_name} duckdb`: Create a new dlt pipeline called {source_name} that loads data into a local DuckDB instance
            - `pip install -r requirements.txt`: Install the Python dependencies for the pipeline"""
            ),
            name="Setup Python environment",
        )

        # editing the resource function to call the requested API
        resource_function_range = Range.from_shorthand(15, 0, 30, 0)
        await sdk.ide.highlightCode(
            RangeInFile(
                filepath=os.path.join(await sdk.ide.getWorkspaceDirectory(), filename),
                range=resource_function_range,
            ),
            "#ffa50033",
        )

        # sdk.set_loading_message("Writing code to call the API...")
        await sdk.edit_file(
            range=resource_function_range,
            filename=filename,
            prompt=f"Edit the resource function to call the API described by this: {self.api_description}. Do not move or remove the exit() call in __main__.",
            name=f"Edit the resource function to call the API {AI_ASSISTED_STRING}",
        )

        time.sleep(1)

        # wait for user to put API key in secrets.toml
        await sdk.ide.setFileOpen(
            await sdk.ide.getWorkspaceDirectory() + "/.dlt/secrets.toml"
        )
        await sdk.wait_for_user_confirmation(
            "If this service requires an API key, please add it to the `secrets.toml` file and then press `Continue`."
        )

        sdk.context.set("source_name", source_name)


class ValidatePipelineStep(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        workspace_dir = await sdk.ide.getWorkspaceDirectory()
        source_name = sdk.context.get("source_name")
        filename = f"{source_name}.py"

        # await sdk.run_step(MessageStep(name="Validate the pipeline", message=dedent("""\
        #         Next, we will validate that your dlt pipeline is working as expected:
        #         - Test that the API call works
        #         - Load the data into a local DuckDB instance
        #         - Write a query to view the data
        #         """)))

        # test that the API call works
        output = await sdk.run(
            f"python3 {filename}",
            name="Test the pipeline",
            description=f"Running `python3 {filename}` to test loading data from the API",
            handle_error=False,
        )

        # If it fails, return the error
        if "Traceback" in output or "SyntaxError" in output:
            output = "Traceback" + output.split("Traceback")[-1]
            file_content = await sdk.ide.readFile(os.path.join(workspace_dir, filename))
            suggestion = await sdk.models.medium.complete(
                dedent(
                    f"""\
                ```python
                {file_content}
                ```
                This above code is a dlt pipeline that loads data from an API. The function with the @resource decorator is responsible for calling the API and returning the data. While attempting to run the pipeline, the following error occurred:

                ```ascii
                {output}
                ```

                This is a brief summary of the error followed by a suggestion on how it can be fixed by editing the resource function:"""
                )
            )

            api_documentation_url = await sdk.models.medium.complete(
                dedent(
                    f"""\
                The API I am trying to call is the '{sdk.context.get('api_description')}'. I tried calling it in the @resource function like this:
                ```python       
                {file_content}
                ```
                What is the URL for the API documentation that will help me learn how to make this call? Please format in markdown so I can click the link."""
                )
            )

            sdk.raise_exception(
                title=f"Error while running pipeline.\nFix the resource function in {filename} and rerun this step",
                message=output,
                with_step=MessageStep(
                    name=f"Suggestion to solve error {AI_ASSISTED_STRING}",
                    message=dedent(
                        f"""\
                {suggestion}
                
                {api_documentation_url}
                
                After you've fixed the code, click the retry button at the top of the Validate Pipeline step above."""
                    ),
                ),
            )

        # remove exit() from the main main function
        await sdk.run_step(
            MessageStep(
                name="Remove early exit() from main function",
                message="Remove the early exit() from the main function now that we are done testing and want the pipeline to load the data into DuckDB.",
            )
        )

        contents = await sdk.ide.readFile(os.path.join(workspace_dir, filename))
        replacement = "\n".join(
            list(filter(lambda line: line.strip() != "exit()", contents.split("\n")))
        )
        await sdk.ide.applyFileSystemEdit(
            FileEdit(
                filepath=os.path.join(workspace_dir, filename),
                replacement=replacement,
                range=Range.from_entire_file(contents),
            )
        )

        # load the data into the DuckDB instance
        await sdk.run(
            f"python3 {filename}",
            name="Load data into DuckDB",
            description=f"Running python3 {filename} to load data into DuckDB",
        )

        tables_query_code = dedent(
            f"""\
            import duckdb

            # connect to DuckDB instance
            conn = duckdb.connect(database="{source_name}.duckdb")

            # list all tables
            print(conn.sql("DESCRIBE"))"""
        )

        query_filename = os.path.join(workspace_dir, "query.py")
        await sdk.apply_filesystem_edit(
            AddFile(filepath=query_filename, content=tables_query_code),
            name="Add query.py file",
            description="Adding a file called `query.py` to the workspace that will run a test query on the DuckDB instance",
        )


class RunQueryStep(Step):
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        output = await sdk.run(
            ".env/bin/python3 query.py",
            name="Run test query",
            description="Running `.env/bin/python3 query.py` to test that the data was loaded into DuckDB as expected",
            handle_error=False,
        )

        if "Traceback" in output or "SyntaxError" in output:
            suggestion = await sdk.models.medium.complete(
                dedent(
                    f"""\
                ```python
                {await sdk.ide.readFile(os.path.join(sdk.ide.workspace_directory, "query.py"))}
                ```
                This above code is a query that runs on the DuckDB instance. While attempting to run the query, the following error occurred:

                ```ascii
                {output}
                ```

                This is a brief summary of the error followed by a suggestion on how it can be fixed:"""
                )
            )

            sdk.raise_exception(
                title="Error while running query",
                message=output,
                with_step=MessageStep(
                    name=f"Suggestion to solve error {AI_ASSISTED_STRING}",
                    message=suggestion
                    + "\n\nIt is also very likely that no duckdb table was created, which can happen if the resource function did not yield any data. Please make sure that it is yielding data and then rerun this step.",
                ),
            )
