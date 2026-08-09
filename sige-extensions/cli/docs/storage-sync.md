# Storage Sync Flow for `cn serve`

## Overview

The `--id <storageId>` flag enables the `cn serve` command to periodically persist session state to an external Continue-managed storage bucket. On startup, the CLI exchanges the provided `storageId` for two pre-signed S3 URLs - one for `session.json` and one for `diff.txt` - and then pushes fresh copies of those files every 30 seconds.

This document captures the responsibilities for both the CLI and backend components so we can iterate on the feature together.

## CLI Responsibilities

- **Flag plumbing**: When `cn serve` is invoked with `--id <storageId>`, the CLI treats that value as an opaque identifier.
- **API key auth**: The CLI attaches the user-level Continue API key (same mechanism we already use for other authenticated requests) to backend calls.
- **Presign handshake**:
  1. On startup, issue `POST https://api.continue.dev/agents/storage/presigned-url` with JSON payload `{ "storageId": "<storageId>" }`.
  2. Expect a response payload containing two pre-signed `PUT` URLs and their target object keys:
     ```json
     {
       "session": {
         "key": "sessions/<sessionId>/session.json",
         "putUrl": "https://<s3-host>/..."
       },
       "diff": {
         "key": "sessions/<sessionId>/diff.txt",
         "putUrl": "https://<s3-host>/..."
       }
     }
     ```
  3. If the call fails, log and continue without remote storage (no retries yet).
- **Periodic uploads**:
  - Every 30 seconds (configurable later), serialize the in-memory session to `session.json` and fetch the `/diff` payload to produce `diff.txt`.
  - Upload both artifacts using their respective `PUT` URLs. For now we overwrite the same objects each cycle.
  - Errors should be logged but non-fatal; the server keeps running.
  - If the repo check fails (no git repo or missing `main`), `diff.txt` uploads an empty string and we log the condition once for debugging.

## Backend Responsibilities

- **Endpoint surface**: `POST /agents/storage/presigned-url` accepts a JSON body `{ "storageId": string }`.
- **Authentication**: Leverage the caller's Continue API key (the request arrives with the standard `Authorization: Bearer <apiKey>` header). Apply normal auth/tenant validation so users can only request URLs tied to their account/org.
- **URL issuance**:
  - Resolve `storageId` into the desired S3 prefix (e.g., `sessions/<org>/<storageId>/`).
  - Generate two short-lived pre-signed `PUT` URLs: one for `session.json`, one for `diff.txt`.
  - Return both URLs and their keys in the response payload described above.
- **Expiration**: URLs are issued with a 60-minute TTL. The CLI automatically refreshes them before expiry (see URL Refresh Strategy below).

## URL Refresh Strategy

Pre-signed URLs are automatically refreshed using a dual-strategy approach:

1. **Proactive Refresh**: URLs are refreshed at the 50-minute mark (10 minutes before expiry) to prevent disruption
2. **Reactive Refresh**: If a 403 Forbidden error is detected (indicating expired URLs), an immediate refresh is triggered
3. **Error Handling**: Upload errors are logged but non-fatal; the service continues running with automatic recovery

This ensures continuous operation during devbox suspension, network interruptions, and clock drift.

## Open Questions & Future Enhancements

- **Upload cadence**: The 30-second interval is hard-coded for now. Consider making it configurable in both CLI and backend policies.
- **Error telemetry**: Decide if repeated upload failures should trip analytics or circuit breakers.
- **Diff source**: `diff.txt` currently mirrors the `/diff` endpoint response. Confirm backend expectations for format and size limits.
- **Security**: We might want to sign responses or enforce stricter scope on `storageId` mapping (e.g., require both org + storageId and validate ownership).

---

This document should evolve alongside implementation details; update it whenever the API contract or client behavior changes.
