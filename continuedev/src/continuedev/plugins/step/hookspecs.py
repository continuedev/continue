from typing import Coroutine
import pluggy
from ...libs.core import ContinueSDK, Step, Observation

hookspec = pluggy.HookspecMarker("continue.step")

# Perhaps Actions should be generic about what their inputs must be.


class StepPlugin(Step):
    @hookspec
    async def run(self, sdk: ContinueSDK) -> Coroutine[Observation, None, None]:
        """Run"""
