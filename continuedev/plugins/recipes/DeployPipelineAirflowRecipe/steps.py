import os
from textwrap import dedent

from ....core.main import Step
from ....core.sdk import ContinueSDK, Models
from ....plugins.steps.core.core import MessageStep
from ....plugins.steps.find_and_replace import FindAndReplaceStep

AI_ASSISTED_STRING = "(✨ AI-Assisted ✨)"


class SetupPipelineStep(Step):
    hide: bool = True
    name: str = "Setup dlt Pipeline"

    source_name: str

    async def describe(self, models: Models):
        pass

    async def run(self, sdk: ContinueSDK):
        await sdk.run(
            [
                "python3 -m venv .env",
                "source .env/bin/activate",
                "pip install dlt",
                f"dlt --non-interactive init {self.source_name} duckdb",
                "pip install -r requirements.txt",
            ],
            description=dedent(
                f"""\
            Running the following commands:
            - `python3 -m venv .env`: Create a Python virtual environment
            - `source .env/bin/activate`: Activate the virtual environment
            - `pip install dlt`: Install dlt
            - `dlt init {self.source_name} duckdb`: Create a new dlt pipeline called {self.source_name} that loads data into a local DuckDB instance
            - `pip install -r requirements.txt`: Install the Python dependencies for the pipeline"""
            ),
            name="Setup Python environment",
        )


class RunPipelineStep(Step):
    hide: bool = True
    name: str = "Run dlt Pipeline"

    source_name: str

    async def describe(self, models: Models):
        pass

    async def run(self, sdk: ContinueSDK):
        await sdk.run(
            [
                f"python3 {self.source_name}_pipeline.py",
            ],
            description=dedent(
                f"""\
            Running the command `python3 {self.source_name}_pipeline.py to run the pipeline: """
            ),
            name="Run dlt pipeline",
        )


class DeployAirflowStep(Step):
    hide: bool = True
    source_name: str

    async def run(self, sdk: ContinueSDK):
        # Run dlt command to deploy pipeline to Airflow
        await sdk.run(
            [
                "git init",
                f"dlt --non-interactive deploy {self.source_name}_pipeline.py airflow-composer",
            ],
            description="Running `dlt deploy airflow` to deploy the dlt pipeline to Airflow",
            name="Deploy dlt pipeline to Airflow",
        )

        # Get filepaths, open the DAG file
        directory = await sdk.ide.getWorkspaceDirectory()
        pipeline_filepath = os.path.join(directory, f"{self.source_name}_pipeline.py")
        dag_filepath = os.path.join(
            directory, f"dags/dag_{self.source_name}_pipeline.py"
        )

        await sdk.ide.setFileOpen(dag_filepath)

        # Replace the pipeline name and dataset name
        await sdk.run_step(
            FindAndReplaceStep(
                filepath=pipeline_filepath,
                pattern="'pipeline_name'",
                replacement=f"'{self.source_name}_pipeline'",
            )
        )
        await sdk.run_step(
            FindAndReplaceStep(
                filepath=pipeline_filepath,
                pattern="'dataset_name'",
                replacement=f"'{self.source_name}_data'",
            )
        )
        await sdk.run_step(
            FindAndReplaceStep(
                filepath=pipeline_filepath,
                pattern="pipeline_or_source_script",
                replacement=f"{self.source_name}_pipeline",
            )
        )

        # Prompt the user for the DAG schedule
        # edit_dag_range = Range.from_shorthand(18, 0, 23, 0)
        # await sdk.ide.highlightCode(range_in_file=RangeInFile(filepath=dag_filepath, range=edit_dag_range), color="#33993333")
        # response = await sdk.run_step(WaitForUserInputStep(prompt="When would you like this Airflow DAG to run? (e.g. every day, every Monday, every 1st of the month, etc.)"))
        # await sdk.edit_file(dag_filepath, prompt=f"Edit the DAG so that it runs at the following schedule: '{response.text}'",
        #                     range=edit_dag_range)

        # Tell the user to check the schedule and fill in owner, email, other default_args
        await sdk.run_step(
            MessageStep(
                message="Fill in the owner, email, and other default_args in the DAG file with your own personal information. Then the DAG will be ready to run!",
                name="Fill in default_args",
            )
        )
