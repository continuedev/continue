# Continue anonymous Posthog telemetry

## Behavior

- Used by Continue for product metrics (not used by customers)
- uses public posthog key in repo
- `CONTINUE_TELEMETRY_ENABLED=0` disables telemetry
- non-anonymous and private data like code is never sent to posthog
- Event user ids are the Continue user id is signed in, or a unique machine id if not
- Current events are slash command usage and chat calls
