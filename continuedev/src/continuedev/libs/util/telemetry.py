from posthog import Posthog
from ...core.config import load_config

# The personal API key is necessary only if you want to use local evaluation of feature flags.
posthog = Posthog('phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs',
                  host='https://app.posthog.com')


def capture_event(event_name, event_properties):
    config = load_config('~/.continue/continue.json')
    if config.allow_anonymous_telemetry:
        posthog.capture("not distinct :(", event_name, event_properties)
