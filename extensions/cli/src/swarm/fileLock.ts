import fs from "fs/promises";
import path from "path";

interface FileLockOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  staleMs?: number;
}

const DEFAULT_OPTIONS: Required<FileLockOptions> = {
  retries: 12,
  minDelayMs: 10,
  maxDelayMs: 200,
  staleMs: 30_000,
};

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function maybeRemoveStaleLock(
  lockPath: string,
  staleMs: number,
): Promise<void> {
  try {
    const stats = await fs.stat(lockPath);
    if (Date.now() - stats.mtimeMs > staleMs) {
      await fs.rm(lockPath, { force: true });
    }
  } catch {
    // Best-effort cleanup only.
  }
}

export async function withFileLock<T>(
  lockPath: string,
  action: () => Promise<T>,
  options?: FileLockOptions,
): Promise<T> {
  const settings = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  let handle: fs.FileHandle | null = null;
  for (let attempt = 0; attempt <= settings.retries; attempt += 1) {
    try {
      handle = await fs.open(lockPath, "wx");
      break;
    } catch (error) {
      if (!isNodeError(error)) {
        throw error;
      }

      if (error.code !== "EEXIST") {
        throw error;
      }

      await maybeRemoveStaleLock(lockPath, settings.staleMs);

      if (attempt === settings.retries) {
        throw new Error(`Timed out acquiring file lock at ${lockPath}`);
      }

      const delay = Math.min(
        settings.maxDelayMs,
        settings.minDelayMs * 2 ** attempt,
      );
      await sleep(delay);
    }
  }

  if (!handle) {
    throw new Error(`Failed to acquire file lock at ${lockPath}`);
  }

  try {
    return await action();
  } finally {
    await handle.close().catch(() => undefined);
    await fs.rm(lockPath, { force: true }).catch(() => undefined);
  }
}
