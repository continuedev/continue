from ...core.main import Step
from ...core.sdk import ContinueSDK


class ClearHistoryStep(Step):
    name: str = "Clear History"
    hide: bool = True

    async def run(self, sdk: ContinueSDK):
        await sdk.clear_history()
