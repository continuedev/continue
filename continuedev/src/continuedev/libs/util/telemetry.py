from typing import Any
from posthog import Posthog
import os
from dotenv import load_dotenv
from .commonregex import clean_pii_from_any

load_dotenv()
in_codespaces = os.getenv("CODESPACES") == "true"
POSTHOG_API_KEY = 'phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs'


class PostHogLogger:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.unique_id = None
        self.allow_anonymous_telemetry = True

    def setup(self, unique_id: str, allow_anonymous_telemetry: bool):
        self.unique_id = unique_id
        self.allow_anonymous_telemetry = allow_anonymous_telemetry

        # The personal API key is necessary only if you want to use local evaluation of feature flags.
        self.posthog = Posthog(self.api_key, host='https://app.posthog.com')

    def capture_event(self, event_name: str, event_properties: Any):
        if not self.allow_anonymous_telemetry or self.unique_id is None:
            return

        if in_codespaces:
            event_properties['codespaces'] = True

        # Send event to PostHog
        self.posthog.capture(self.unique_id, event_name,
                             clean_pii_from_any(event_properties))


posthog_logger = PostHogLogger(api_key=POSTHOG_API_KEY)
