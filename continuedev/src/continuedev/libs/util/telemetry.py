from typing import Any
from posthog import Posthog
from ...core.config import load_config
import os
from dotenv import load_dotenv
from .commonregex import clean_pii_from_any

load_dotenv()
in_codespaces = os.getenv("CODESPACES") == "true"

# The personal API key is necessary only if you want to use local evaluation of feature flags.
posthog = Posthog('phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs',
                  host='https://app.posthog.com')


def capture_event(unique_id: str, event_name: str, event_properties: Any):
    # Return early if telemetry is disabled
    config = load_config('.continue/config.json')
    if not config.allow_anonymous_telemetry:
        return

    if in_codespaces:
        event_properties['codespaces'] = True

    # Send event to PostHog
    posthog.capture(unique_id, event_name,
                    clean_pii_from_any(event_properties))
