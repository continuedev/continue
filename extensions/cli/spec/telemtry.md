# Yuto Agentic anonymous Posthog telemetry

## Behavior

- Used by Yuto Agentic for product metrics (not used by customers)
- uses public posthog key in repo
- `CONTINUE_TELEMETRY_ENABLED=0` disables telemetry
- non-anonymous and private data like code is never sent to posthog
- Event user ids are the Yuto Agentic user id is signed in, or a unique machine id if not
- Current events are slash command usage and chat calls
