from ...core.main import SessionUpdate, SetStep, Step
from ...core.sdk import ContinueSDK


class ClearHistoryStep(Step):
    name: str = "Clear History"
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        index = len(sdk.history)
        for i in range(index - 1, -1, -1):
            yield SessionUpdate(index=i, update=SetStep(hide=True))
