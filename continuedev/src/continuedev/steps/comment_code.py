from ..core.main import ContinueSDK, Models, Step
from .main import StarCoderEditHighlightedCodeStep


class CommentCodeStep(Step):
    hide: bool = True

    async def describe(self, models: Models):
        return "Writing comments"

    async def run(self, sdk: ContinueSDK):
        await sdk.run_step(StarCoderEditHighlightedCodeStep(user_input="Wrote comprehensive comments in the canonical format for every class and function"))
