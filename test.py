import asyncio

from continuedev.src.continuedev.headless import run_step_headless
from continuedev.src.continuedev.models.main import Position, PositionInFile
from continuedev.src.continuedev.plugins.steps.refactor import RefactorReferencesStep


async def main():
    step = RefactorReferencesStep(
        user_input="Update all usage of the function to use the new name (capture instead of capture_event)",
        symbol_location=PositionInFile(
            filepath="/Users/natesesti/Desktop/continue/continuedev/src/continuedev/libs/util/telemetry.py",
            position=Position(line=40, character=14),
        ),
    )
    await run_step_headless(step=step)


if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main())
    tasks = asyncio.all_tasks(loop)
    loop.run_until_complete(asyncio.gather(*tasks))
