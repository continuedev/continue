# Artifact Upload Architecture

## Overview

The artifact upload feature enables Continue agents running in devboxes to upload arbitrary files (screenshots, videos, logs) to agent session storage for review and debugging purposes. The architecture uses a two-step presigned URL pattern for secure, performant uploads.

## Architecture Pattern: Presigned URLs

### Why Presigned URLs?

The artifact upload system uses **presigned URLs** for direct client-to-S3 uploads rather than proxying files through the backend. This design provides several benefits:

1. **Security**: The backend controls who can upload, validates file types/sizes, and enforces storage limits before issuing a presigned URL. The agent cannot bypass these validations.

2. **Performance**: Files upload directly from the devbox to S3, avoiding bandwidth costs and latency of routing through the backend API server.

3. **Scalability**: The backend doesn't become a bottleneck for file uploads. S3 handles the heavy lifting of data transfer.

4. **Simplicity**: Presigned URLs are time-limited (15 minutes), self-contained credentials that require no complex token management.

## Two-Step Upload Flow

### Step 1: Request Presigned URL

The agent requests a presigned upload URL from the backend:

**Request:**

```http
POST /agents/artifacts/upload-url
Authorization: Bearer <CONTINUE_API_KEY>
Content-Type: application/json

{
  "agentSessionId": "<session-id>",
  "filename": "screenshot.png",
  "contentType": "image/png",
  "fileSize": 1048576
}
```

**Backend Validation:**

- Authenticates the API key and verifies session ownership
- Validates filename (no path traversal, allowed extension)
- Validates file size against per-file limit (50MB default)
- Validates content type against allowlist
- Checks total session storage against limit (500MB default)

**Response (if validation passes):**

```json
{
  "url": "https://s3.amazonaws.com/bucket/sessions/org/abc123/artifacts/screenshot.png?X-Amz-...",
  "key": "sessions/org/abc123/artifacts/screenshot.png",
  "expiresIn": 900
}
```

**Response (if validation fails):**

```http
400 Bad Request

{
  "error": "File size exceeds maximum allowed (50MB)"
}
```

### Step 2: Upload to S3

The agent uploads the file directly to S3 using the presigned URL:

**Request:**

```http
PUT <presigned-url>
Content-Type: image/png
<file-contents>
```

S3 validates the presigned URL signature and accepts the upload. The backend is not involved in this step.

## Storage Organization

Artifacts are stored in S3 with the following path structure:

```
sessions/
  user/
    <userId>/
      <sessionId>/
        artifacts/
          screenshot.png
          video.mp4
          debug.log
        session.json        # Session state (existing)
        diff.txt           # Git diff (existing)
  org/
    <organizationId>/
      <sessionId>/
        artifacts/
          ...
```

This structure:

- Maintains backward compatibility with existing `session.json` and `diff.txt` files
- Isolates user/org data for security
- Groups all session-related files together
- Allows simple recursive deletion when a session is removed

## File Type and Size Limits

### Allowed File Types

The system validates both file extensions and MIME types:

**Images:** `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
**Videos:** `.mp4`, `.mov`, `.avi`, `.webm`
**Text/Logs:** `.log`, `.txt`, `.json`, `.xml`, `.csv`, `.html`

Content types are validated against an allowlist to prevent uploading executable files or other potentially dangerous content.

### Size Limits

Two limits are enforced:

1. **Per-File Limit:** 50MB (configurable via `ARTIFACT_MAX_FILE_SIZE_MB`)
2. **Total Session Storage:** 500MB (configurable via `ARTIFACT_MAX_TOTAL_SIZE_MB`)

The backend calculates total storage by summing all files under the session's S3 prefix before issuing presigned URLs. This prevents a single session from consuming excessive storage.

## CLI Usage

### Using the UploadArtifact Tool (Recommended)

The `UploadArtifact` tool is available when running with the beta flag:

```bash
cn serve --id <agentSessionId> --beta-upload-artifact-tool
```

Agents can then use the built-in `UploadArtifact` tool to upload files:

```typescript
// The agent calls this tool with the file path
{
  "name": "UploadArtifact",
  "parameters": {
    "filePath": "/tmp/screenshot.png"
  }
}
```

The tool will:

- Validate the file exists and is an allowed type
- Check file size limits (50MB max per file)
- Upload to session storage
- Return success message or detailed error

**Tool Description:** "Upload a file (screenshot, video, log) to the session artifacts for user review. Supported formats: images (png, jpg, jpeg, gif, webp), videos (mp4, mov, avi, webm), and text files (log, txt, json, xml, csv, html). Maximum file size: 50MB. **If an artifact with the same filename already exists, it will be overwritten with the new file.**"

**Requirements:**

- Must run with `--id <agentSessionId>` (agent mode)
- Must enable `--beta-upload-artifact-tool` flag
- User must be authenticated (`cn login`)

### Programmatic Upload (Service API)

For custom implementations, use the service directly:

```typescript
import { services } from "./services/index.js";

const result = await services.artifactUpload.uploadArtifact({
  agentSessionId: process.env.AGENT_SESSION_ID,
  filePath: "/tmp/screenshot.png",
  accessToken: process.env.CONTINUE_API_KEY,
});

if (result.success) {
  console.log(`Uploaded: ${result.filename}`);
} else {
  console.error(`Failed: ${result.error}`);
}
```

### Multiple Files

```typescript
const results = await services.artifactUpload.uploadArtifacts(
  process.env.AGENT_SESSION_ID,
  ["/tmp/screenshot1.png", "/tmp/screenshot2.png", "/tmp/debug.log"],
  process.env.CONTINUE_API_KEY,
);

results.forEach((result) => {
  console.log(`${result.filename}: ${result.success ? "✓" : "✗"}`);
});
```

## Environment Variables

The CLI requires these environment variables for artifact uploads:

- `CONTINUE_API_KEY`: Bearer token for backend authentication
- `CONTINUE_API_BASE`: API base URL (defaults to `https://api.continue.dev/`)
- `AGENT_SESSION_ID`: The current agent session identifier

These are automatically provided when running in Continue's devbox environment.

## Error Handling

### Validation Errors (400)

- Invalid filename (path traversal, disallowed extension)
- File too large (exceeds per-file limit)
- Storage limit exceeded (session total > 500MB)
- Invalid content type

### Authentication Errors (401/403)

- Missing or invalid API key
- User doesn't own the agent session

### Upload Errors (S3)

- Network failure during upload
- Presigned URL expired (15-minute timeout)
- S3 service error

All errors are logged and returned with descriptive messages. Failed uploads don't crash the agent - they return an error result that the agent can handle gracefully.

## Frontend Access

The frontend can list and download artifacts using:

**List artifacts:**

```http
GET /agents/{agentSessionId}/artifacts
Authorization: Bearer <API_KEY>

Response:
{
  "artifacts": [
    {
      "filename": "screenshot.png",
      "size": 1048576,
      "sizeFormatted": "1.0 MB",
      "lastModified": "2025-12-08T10:30:00Z"
    }
  ]
}
```

**Download artifact:**

```http
GET /agents/{agentSessionId}/artifacts/{filename}/download
Authorization: Bearer <API_KEY>

Response:
{
  "url": "https://s3.amazonaws.com/...",
  "expiresIn": 3600
}
```

The frontend then uses the presigned download URL to fetch the artifact directly from S3.

## Security Considerations

1. **Authentication**: All endpoints require valid API keys tied to user/org accounts
2. **Authorization**: Session ownership is verified before issuing presigned URLs
3. **Path Traversal Prevention**: Filenames are validated to prevent `../` attacks
4. **Content Validation**: File types are restricted via extension and MIME type checks
5. **Rate Limiting**: Storage limits prevent abuse (per-file and total session limits)
6. **Time-Limited URLs**: Presigned URLs expire after 15 minutes for uploads, 1 hour for downloads
7. **Storage Isolation**: Files are scoped to user/org prefixes, preventing cross-tenant access

## Design Trade-offs

### Chosen: No Database Tracking

**Decision:** Store artifacts as files in S3 without tracking individual files in the database.

**Rationale:**

- Simpler implementation (no new database tables)
- Files are the source of truth (no sync issues between DB and S3)
- Fast listing via S3 API (ListObjects)
- Automatic cleanup when deleting session folder

**Trade-off:** Cannot query artifacts across sessions or track metadata without scanning S3.

### Chosen: Overwrite on Name Collision

**Decision:** If the same filename is uploaded twice, the last upload wins.

**Rationale:**

- Simpler than versioning or auto-renaming
- Common use case: agent re-uploading updated screenshot
- Reduces storage consumption

**Trade-off:** No version history for artifacts.

### Chosen: Direct S3 Upload (Presigned URLs)

**Decision:** Use presigned URLs instead of proxying files through backend.

**Rationale:**

- Better performance (no backend bottleneck)
- Lower cost (no backend bandwidth charges)
- Proven pattern (already used in StorageSyncService)

**Trade-off:** Backend cannot inspect file contents before upload (relies on validation at URL generation).

## Future Enhancements

- **Compression**: Automatically compress screenshots/videos before upload
- **Retention Policies**: Auto-delete artifacts after N days
- **Artifact Types**: Support more file types (PDFs, archives)
- **Preview Generation**: Generate thumbnails for images/videos
- **Streaming**: Support large file uploads with multipart upload
- **Metadata**: Attach custom metadata to artifacts (tags, descriptions)

---

This document describes the initial artifact upload implementation. Update it when the architecture evolves.
