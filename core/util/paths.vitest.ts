import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("migrate", () => {
  let continueGlobalDir: string | undefined;

  beforeEach(() => {
    continueGlobalDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "continue-migration-test-"),
    );
    vi.stubEnv("CONTINUE_GLOBAL_DIR", continueGlobalDir);
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();

    if (continueGlobalDir) {
      fs.rmSync(continueGlobalDir, { recursive: true, force: true });
      continueGlobalDir = undefined;
    }
  });

  it("retries a migration when its previous attempt failed", async () => {
    const { migrate } = await import("./paths.js");
    const migration = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(undefined);
    const migrationPath = path.join(
      continueGlobalDir!,
      ".migrations",
      "retry-after-failure",
    );

    await migrate("retry-after-failure", migration);
    expect(fs.existsSync(migrationPath)).toBe(false);

    await migrate("retry-after-failure", migration);

    expect(migration).toHaveBeenCalledTimes(2);
    expect(fs.existsSync(migrationPath)).toBe(true);

    const onAlreadyComplete = vi.fn();
    await migrate("retry-after-failure", migration, onAlreadyComplete);
    expect(migration).toHaveBeenCalledTimes(2);
    expect(onAlreadyComplete).toHaveBeenCalledOnce();
  });

  it("does not run the same migration while it is already in progress", async () => {
    const { migrate } = await import("./paths.js");
    let resolveFirstMigration: (() => void) | undefined;
    const firstMigration = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstMigration = resolve;
        }),
    );
    const skippedMigration = vi.fn();
    const onConcurrentMigration = vi.fn();

    const firstRun = migrate("concurrent-migration", firstMigration);
    await migrate(
      "concurrent-migration",
      skippedMigration,
      onConcurrentMigration,
    );

    expect(skippedMigration).not.toHaveBeenCalled();
    expect(onConcurrentMigration).toHaveBeenCalledOnce();

    if (!resolveFirstMigration) {
      throw new Error("The first migration did not start");
    }
    resolveFirstMigration();
    await firstRun;
    expect(
      fs.existsSync(
        path.join(continueGlobalDir!, ".migrations", "concurrent-migration"),
      ),
    ).toBe(true);
  });
});
