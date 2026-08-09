// IMPORTANT: This file must run BEFORE any module that imports
// `core/util/paths.ts`, because that module resolves `CONTINUE_GLOBAL_DIR`
// into a constant at import time. If multiple test files (which run in
// parallel worker processes) all share the same global dir, they race on the
// same `globalContext.json` file on disk, causing flaky failures in the
// model-persistence tests.
//
// To guarantee isolation, give each worker process its own unique global dir.
// This file is intentionally dependency-free (no imports that transitively
// load `paths.ts`) and is listed first in `setupFiles` so the env var is set
// before any other module captures it.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const globalDir = fs.mkdtempSync(path.join(os.tmpdir(), "continue-cli-test-"));
process.env.CONTINUE_GLOBAL_DIR = globalDir;

// Best-effort cleanup of this worker's temp dir when the process exits.
process.on("exit", () => {
  try {
    fs.rmSync(globalDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors on exit.
  }
});
