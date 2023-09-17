from continuedev.src.continuedev.headless import run_step_headless
from continuedev.src.continuedev.models.main import Position, PositionInFile
from continuedev.src.continuedev.plugins.steps.refactor import RefactorReferencesStep

step = RefactorReferencesStep(
    user_input="Add 'title': 'TEST' to the dictionary in the second arg of capture_eventx. Your response will exaclty replace the code you see, so don't give any extra explanation, and maintain whitespace.",
    symbol_location=PositionInFile(
        filepath="/Users/natesesti/Desktop/continue/continuedev/src/continuedev/libs/util/telemetry.py",
        position=Position(line=40, character=14),
    ),
)
run_step_headless(step=step)
