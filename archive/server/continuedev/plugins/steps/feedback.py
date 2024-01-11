from ...core.main import Models, Step
from ...core.sdk import ContinueSDK
from ...libs.util.telemetry import posthog_logger


class FeedbackStep(Step):
    user_input: str
    name = "Thanks for your feedback!"

    async def describe(self, models: Models):
        return f"`{self.user_input}`\n\nWe'll see your feedback and make improvements as soon as possible. If you'd like to directly email us, you can contact [nate@continue.dev](mailto:nate@continue.dev?subject=Feedback%20On%20Continue)."

    async def run(self, sdk: ContinueSDK):
        posthog_logger.capture_event("feedback", {"feedback": self.user_input})
