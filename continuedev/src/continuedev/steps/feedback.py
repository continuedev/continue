from ..core.main import Step
from ..core.sdk import ContinueSDK
from ..libs.util.telemetry import capture_event


class FeedbackStep(Step):
    user_input: str

    async def run(self, sdk: ContinueSDK):
        capture_event("feedback", {"feedback": self.user_input})
