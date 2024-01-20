
from ...core.main import Step
from ...core.sdk import ContinueSDK, Models


class StepsOnStartupStep(Step):
    hide: bool = True

    async def describe(self, models: Models) -> str:
        return "Running steps on startup"

    async def run(self, sdk: ContinueSDK) -> None:
        steps_on_startup = sdk.config.steps_on_startup

        for step_type in steps_on_startup:
            step = step_type if isinstance(step_type, Step) else step_type()

            await sdk.run_step(step)
