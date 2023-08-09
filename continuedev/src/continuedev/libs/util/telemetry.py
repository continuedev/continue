from typing import Any
from posthog import Posthog
import os
from dotenv import load_dotenv
from .commonregex import clean_pii_from_any
from .logging import logger
from .paths import getServerFolderPath
from ..constants.main import CONTINUE_SERVER_VERSION_FILE

load_dotenv()
in_codespaces = os.getenv("CODESPACES") == "true"
POSTHOG_API_KEY = 'phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs'


class PostHogLogger:
    unique_id: str = "NO_UNIQUE_ID"
    allow_anonymous_telemetry: bool = True

    def __init__(self, api_key: str):
        self.api_key = api_key

        # The personal API key is necessary only if you want to use local evaluation of feature flags.
        self.posthog = Posthog(self.api_key, host='https://app.posthog.com')

    def setup(self, unique_id: str, allow_anonymous_telemetry: bool):
        self.unique_id = unique_id or "NO_UNIQUE_ID"
        self.allow_anonymous_telemetry = allow_anonymous_telemetry or True

    def capture_event(self, event_name: str, event_properties: Any):
        # logger.debug(
        #     f"Logging to PostHog: {event_name} ({self.unique_id}, {self.allow_anonymous_telemetry}): {event_properties}")
        telemetry_path = os.path.expanduser("~/.continue/telemetry.log")

        # Make sure the telemetry file exists
        if not os.path.exists(telemetry_path):
            os.makedirs(os.path.dirname(telemetry_path), exist_ok=True)
            open(telemetry_path, "w").close()

        with open(telemetry_path, "a") as f:
            str_to_write = f"{event_name}: {event_properties}\n{self.unique_id}\n{self.allow_anonymous_telemetry}\n\n"
            f.write(str_to_write)

        if not self.allow_anonymous_telemetry:
            return

        # Clean PII from event properties
        event_properties = clean_pii_from_any(event_properties)

        # Add additional properties that are on every event
        if in_codespaces:
            event_properties['codespaces'] = True

        server_version_file = os.path.join(
            getServerFolderPath(), CONTINUE_SERVER_VERSION_FILE)
        if os.path.exists(server_version_file):
            with open(server_version_file, "r") as f:
                event_properties['server_version'] = f.read()

        # Send event to PostHog
        self.posthog.capture(self.unique_id, event_name, event_properties)


posthog_logger = PostHogLogger(api_key=POSTHOG_API_KEY)
