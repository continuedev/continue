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


class SetupPipelineStep(Step):
    hide: bool = True
    name: str = "Setup dlt Pipeline"

    source_name: str

    async def describe(self, models: Models):
        pass

    async def run(self, sdk: ContinueSDK):
        await sdk.run([
            'python3 -m venv env',
            'source env/bin/activate',
            'pip install dlt',
            f'dlt --non-interactive init {self.source_name} duckdb',
            'pip install -r requirements.txt'
        ], description=dedent(f"""\
            Running the following commands:
            - `python3 -m venv env`: Create a Python virtual environment
            - `source env/bin/activate`: Activate the virtual environment
            - `pip install dlt`: Install dlt
            - `dlt init {self.source_name} duckdb`: Create a new dlt pipeline called {self.source_name} that loads data into a local DuckDB instance
            - `pip install -r requirements.txt`: Install the Python dependencies for the pipeline"""), name="Setup Python environment")
