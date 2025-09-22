import chalk from "chalk";

import { env } from "../env.js";
import { formatError } from "../util/formatError.js";
import { getGitDiffSnapshot } from "../util/git.js";
import { logger } from "../util/logger.js";

import type { StorageSyncServiceState } from "./types.js";

const DEFAULT_UPLOAD_INTERVAL_MS = 30_000;

type StoragePresignedLocation = {
  key: string;
  putUrl: string;
};

type StoragePresignResponse = {
  session?: StoragePresignedLocation;
  diff?: StoragePresignedLocation;
};

type StorageTargets = {
  sessionUrl: string;
  diffUrl: string;
};

export interface StorageSyncStartOptions {
  storageId: string;
  accessToken: string;
  intervalMs?: number;
  syncSessionHistory: () => void;
  getSessionSnapshot: () => unknown;
  isActive?: () => boolean;
}

export class StorageSyncService {
  private state: StorageSyncServiceState = {
    isEnabled: false,
    lastError: null,
  };

  private intervalHandle: NodeJS.Timeout | null = null;
  private stopped = true;
  private uploadInFlight = false;
  private missingRepoLogged = false;
  private targets: StorageTargets | null = null;
  private options: StorageSyncStartOptions | null = null;

  async initialize(): Promise<StorageSyncServiceState> {
    this.stop();
    return this.getState();
  }

  getState(): StorageSyncServiceState {
    return { ...this.state };
  }

  getDefaultInterval(): number {
    return DEFAULT_UPLOAD_INTERVAL_MS;
  }

  async startFromOptions(
    options: {
      storageOption?: string;
      accessToken?: string | null;
    } & Omit<StorageSyncStartOptions, "storageId" | "accessToken">,
  ): Promise<boolean> {
    const { storageOption, accessToken, ...rest } = options;

    if (!storageOption) {
      return false;
    }

    const storageId = storageOption.trim();
    if (!storageId) {
      logger.warn(
        "Storage sync requested but the provided storage identifier was empty; skipping uploads.",
      );
      return false;
    }

    if (!accessToken) {
      logger.warn(
        "Storage sync requested but no Continue API key is available; skipping uploads.",
      );
      return false;
    }

    return this.start({
      storageId,
      accessToken,
      ...rest,
    });
  }

  async start(options: StorageSyncStartOptions): Promise<boolean> {
    // Ensure any existing sync loop is stopped before starting a new one
    this.stop();

    const targets = await this.requestStorageTargets(
      options.storageId,
      options.accessToken,
    );

    if (!targets) {
      this.setState({
        isEnabled: false,
        storageId: options.storageId,
        lastError: "Failed to obtain presigned URLs",
      });
      return false;
    }

    this.targets = targets;
    this.options = options;
    this.stopped = false;
    this.uploadInFlight = false;
    this.missingRepoLogged = false;
    this.setState({
      isEnabled: true,
      storageId: options.storageId,
      lastError: null,
      lastUploadAt: undefined,
    });

    const intervalMs = options.intervalMs ?? DEFAULT_UPLOAD_INTERVAL_MS;
    logger.info(
      chalk.dim(
        `Storage sync enabled (uploading every ${Math.round(intervalMs / 1000)}s)`,
      ),
    );

    await this.performUpload();

    this.intervalHandle = setInterval(() => {
      void this.performUpload();
    }, intervalMs);

    return true;
  }

  stop(): void {
    this.stopped = true;
    this.targets = null;
    this.options = null;
    this.uploadInFlight = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    if (this.state.isEnabled) {
      this.setState({
        isEnabled: false,
        storageId: this.state.storageId,
        lastError: null,
        lastUploadAt: this.state.lastUploadAt,
      });
    }
  }

  private setState(next: StorageSyncServiceState): void {
    this.state = { ...next };
  }

  private async requestStorageTargets(
    storageId: string,
    accessToken: string,
  ): Promise<StorageTargets | null> {
    const url = new URL("agents/storage/presigned-url", env.apiBase);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ storageId }),
      });

      if (!response.ok) {
        const statusText = `${response.status} ${response.statusText}`.trim();
        logger.warn(
          `Storage sync presign request failed (${statusText}). Storage uploads disabled for this session.`,
        );
        return null;
      }

      const body = (await response.json()) as StoragePresignResponse;

      if (!body.session?.putUrl || !body.diff?.putUrl) {
        logger.warn(
          "Storage sync presign response missing required URLs. Storage uploads disabled for this session.",
        );
        return null;
      }

      return {
        sessionUrl: body.session.putUrl,
        diffUrl: body.diff.putUrl,
      };
    } catch (error) {
      logger.warn(
        `Storage sync presign request failed: ${formatError(error)}. Storage uploads disabled for this session.`,
      );
      return null;
    }
  }

  private async uploadToPresignedUrl(
    url: string,
    body: string,
    contentType: string,
  ): Promise<void> {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body,
    });

    if (!response.ok) {
      const statusText = `${response.status} ${response.statusText}`.trim();
      throw new Error(`Storage upload failed (${statusText})`);
    }
  }

  private async performUpload(): Promise<void> {
    if (this.stopped || this.uploadInFlight || !this.targets || !this.options) {
      return;
    }

    if (this.options.isActive && !this.options.isActive()) {
      return;
    }

    this.uploadInFlight = true;

    try {
      this.options.syncSessionHistory();
      const snapshot = this.options.getSessionSnapshot();
      const sessionPayload = JSON.stringify(snapshot, null, 2);
      await this.uploadToPresignedUrl(
        this.targets.sessionUrl,
        sessionPayload,
        "application/json",
      );

      const diffResult = await getGitDiffSnapshot();
      if (!diffResult.repoFound && !this.missingRepoLogged) {
        logger.debug(
          "Storage sync diff upload skipped: not in a git repository or main branch missing.",
        );
        this.missingRepoLogged = true;
      }
      await this.uploadToPresignedUrl(
        this.targets.diffUrl,
        diffResult.diff,
        "text/plain",
      );

      this.setState({
        isEnabled: true,
        storageId: this.state.storageId,
        lastUploadAt: Date.now(),
        lastError: null,
      });
    } catch (error) {
      this.setState({
        isEnabled: true,
        storageId: this.state.storageId,
        lastUploadAt: this.state.lastUploadAt,
        lastError: formatError(error),
      });
      logger.warn(`Storage sync upload failed: ${formatError(error)}`);
    } finally {
      this.uploadInFlight = false;
    }
  }
}
