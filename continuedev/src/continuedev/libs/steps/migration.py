# When an edit is made to an existing class or a new sqlalchemy class is created,
# this should be kicked off.

from ...models.filesystem import RangeInFile
from .main import EditCodeStep, RunCommandStep
from ..core import Step


class MigrationStep(Step):
    name: str = "Create and run an alembic migration."

    edited_file: str

    async def run(self, sdk):
        recent_edits = await sdk.ide.get_recent_edits(self.edited_file)
        recent_edits_string = "\n\n".join(
            map(lambda x: x.to_string(), recent_edits))
        description = await sdk.llm.complete(f"{recent_edits_string}\n\nGenerate a short description of the migration made in the above changes:\n")
        await sdk.run_step(RunCommandStep(cmd=f"cd libs && poetry run alembic revision --autogenerate -m {description}"))
        migration_file = f"libs/alembic/versions/{?}.py"
        contents = await sdk.ide.readFile(migration_file)
        await sdk.run_step(EditCodeStep(
            range_in_files=[RangeInFile.from_entire_file(migration_file, contents)],
            prompt=f"Here are the changes made to the sqlalchemy classes:\n\n{recent_edits_string}\n\nThis is the generated migration file:\n\n{{code}}\n\nReview the migration file to make sure it correctly reflects the changes made to the sqlalchemy classes.",
        ))
        await sdk.run_step(RunCommandStep(cmd="cd libs && poetry run alembic upgrade head"))
