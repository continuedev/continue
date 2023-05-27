from typing import Coroutine
import pluggy
from ...core.main import Step
from ...core.observation import Observation
from ...core.sdk import ContinueSDK

hookspec = pluggy.HookspecMarker("continue.step")

# Perhaps Actions should be generic about what their inputs must be.


class StepPlugin(Step):
    @hookspec
    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        """Run"""
