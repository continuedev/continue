# Devbox entrypoint behavior (yt serve)

Context: runloop resumes a devbox by re-running the same entrypoint script, which invokes `yt serve --id <agentId> ...`. Because the entrypoint always replays, the CLI must avoid duplicating state on restart.

- **Session reuse:** `serve` now calls `loadOrCreateSessionById` when `--id` is provided so the same session file is reused instead of generating a new UUID. This keeps chat history intact across suspend/resume.
- **Skip replaying the initial prompt:** `shouldQueueInitialPrompt` checks existing history and only queues the initial prompt when there are no non-system messages. This prevents the first prompt from being resent when a suspended devbox restarts.
- **Environment persistence:** The devbox entrypoint (control-plane) writes all env vars to `~/.yutoagentic/devbox-env` and sources it before `yt serve`, so keys survive suspend/resume. The CLI assumes env is already present.

Operational notes:

- Changing the entrypoint is expensive; prefer adapting CLI/session behavior as above.
- When testing suspend/resume, confirm a single session file under `~/.yutoagentic/sessions` for the agent id and that follow-up messages append normally without replaying the first prompt.
