import fs from "fs";
import path from "path";
import os from "os";

// Want this outside of the git repository so we can change branches in tests
export const TEST_DIR = path.join(os.tmpdir(), "testDir");

export function setUpTestDir() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR);
}

export function tearDownTestDir() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
}

export function addToTestDir(paths: (string | string[])[]) {
  for (const p of paths) {
    const filepath = path.join(TEST_DIR, Array.isArray(p) ? p[0] : p);
    fs.mkdirSync(path.dirname(filepath), { recursive: true });

    if (Array.isArray(p)) {
      fs.writeFileSync(filepath, p[1]);
    } else if (p.endsWith("/")) {
      fs.mkdirSync(filepath, { recursive: true });
    } else {
      fs.writeFileSync(filepath, "");
    }
  }
}
