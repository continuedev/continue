import * as fs from "fs";
import * as path from "path";

import { env } from "../env.js";
import { formatError } from "../util/formatError.js";
import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";
import type { ArtifactUploadServiceState } from "./types.js";

/**
 * Response from backend when requesting a presigned upload URL
 */
type ArtifactPresignedUrlResponse = {
  url: string;
  key: string;
  expiresIn: number;
};

/**
 * Options for uploading an artifact file
 */
export interface ArtifactUploadOptions {
  /** The agent session ID to upload to */
  agentSessionId: string;
  /** Path to the file to upload */
  filePath: string;
  /** Optional content type (auto-detected from extension if not provided) */
  contentType?: string;
  /** Access token for authentication */
  accessToken: string;
}

/**
 * Result of an artifact upload attempt
 */
export interface ArtifactUploadResult {
  success: boolean;
  filename: string;
  error?: string;
}

/**
 * Service for uploading artifact files (screenshots, videos, logs) to agent sessions.
 *
 * Architecture:
 * 1. Request presigned URL from backend API
 * 2. Upload file directly to S3 using presigned URL
 * 3. Backend validates file size, type, and storage limits before issuing URL
 *
 * This two-step process provides security (backend controls access) and performance
 * (direct S3 upload without proxying through backend).
 */
export class ArtifactUploadService extends BaseService<ArtifactUploadServiceState> {
  constructor() {
    super("artifactUpload", {
      uploadsInProgress: 0,
      lastError: null,
    });
  }

  async doInitialize(): Promise<ArtifactUploadServiceState> {
    return this.getState();
  }

  /**
   * Upload an artifact file to an agent session.
   *
   * @param options Upload options including session ID, file path, and auth token
   * @returns Upload result with success status and error if failed
   */
  async uploadArtifact(
    options: ArtifactUploadOptions,
  ): Promise<ArtifactUploadResult> {
    const filename = path.basename(options.filePath);

    // Validate file exists
    if (!fs.existsSync(options.filePath)) {
      const error = `File not found: ${options.filePath}`;
      logger.error(error);
      return { success: false, filename, error };
    }

    // Get file stats
    const stats = fs.statSync(options.filePath);
    const fileSizeBytes = stats.size;

    // Detect content type if not provided
    const contentType = options.contentType ?? this.inferContentType(filename);

    this.setState({
      uploadsInProgress: this.currentState.uploadsInProgress + 1,
      lastError: null,
    });

    try {
      // Step 1: Request presigned URL from backend
      logger.info(`Requesting upload URL for artifact: ${filename}`);
      const presignedData = await this.requestPresignedUploadUrl(
        options.agentSessionId,
        filename,
        contentType,
        fileSizeBytes,
        options.accessToken,
      );

      if (!presignedData) {
        const error = "Failed to obtain presigned upload URL";
        this.setState({
          uploadsInProgress: this.currentState.uploadsInProgress - 1,
          lastError: error,
        });
        return { success: false, filename, error };
      }

      // Step 2: Upload file directly to S3
      logger.info(`Uploading artifact to S3: ${filename}`);
      await this.uploadFileToS3(
        presignedData.url,
        options.filePath,
        contentType,
      );

      logger.info(`Successfully uploaded artifact: ${filename}`);
      this.setState({
        uploadsInProgress: this.currentState.uploadsInProgress - 1,
        lastError: null,
      });

      return { success: true, filename };
    } catch (error) {
      const errorMsg = formatError(error);
      logger.error(`Failed to upload artifact ${filename}: ${errorMsg}`);
      this.setState({
        uploadsInProgress: this.currentState.uploadsInProgress - 1,
        lastError: errorMsg,
      });
      return { success: false, filename, error: errorMsg };
    }
  }

  /**
   * Upload multiple artifacts in parallel.
   *
   * @param agentSessionId The agent session ID
   * @param filePaths Array of file paths to upload
   * @param accessToken Access token for authentication
   * @returns Array of upload results
   */
  async uploadArtifacts(
    agentSessionId: string,
    filePaths: string[],
    accessToken: string,
  ): Promise<ArtifactUploadResult[]> {
    const uploadPromises = filePaths.map((filePath) =>
      this.uploadArtifact({
        agentSessionId,
        filePath,
        accessToken,
      }),
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Request a presigned URL from the backend API for uploading an artifact.
   */
  private async requestPresignedUploadUrl(
    agentSessionId: string,
    filename: string,
    contentType: string,
    fileSizeBytes: number,
    accessToken: string,
  ): Promise<ArtifactPresignedUrlResponse | null> {
    const url = new URL("agents/artifacts/upload-url", env.apiBase);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          agentSessionId,
          filename,
          contentType,
          fileSize: fileSizeBytes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg =
          errorData.error || `${response.status} ${response.statusText}`;
        logger.warn(`Failed to get presigned upload URL: ${errorMsg}`);
        return null;
      }

      const data = (await response.json()) as ArtifactPresignedUrlResponse;

      if (!data.url) {
        logger.warn("Presigned URL response missing required 'url' field");
        return null;
      }

      return data;
    } catch (error) {
      logger.warn(
        `Error requesting presigned upload URL: ${formatError(error)}`,
      );
      return null;
    }
  }

  /**
   * Upload a file to S3 using a presigned URL.
   */
  private async uploadFileToS3(
    presignedUrl: string,
    filePath: string,
    contentType: string,
  ): Promise<void> {
    // Read file contents
    const fileBuffer = fs.readFileSync(filePath);

    // Upload to S3
    const response = await fetch(presignedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const statusText = `${response.status} ${response.statusText}`.trim();
      const responseBody = await response.text();
      throw new Error(`S3 upload failed (${statusText}): ${responseBody}`);
    }
  }

  /**
   * Infer content type from file extension.
   */
  private inferContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();

    const contentTypeMap: Record<string, string> = {
      // Images
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      // Videos
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
      ".webm": "video/webm",
      // Text/Logs
      ".log": "text/plain",
      ".txt": "text/plain",
      ".json": "application/json",
      ".xml": "text/xml",
      ".csv": "text/csv",
      ".html": "text/html",
    };

    return contentTypeMap[ext] || "application/octet-stream";
  }
}
