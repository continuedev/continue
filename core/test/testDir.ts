import fs from "fs";
import os from "os";
import path from "path";

// Want this outside of the git repository so we can change branches in tests
export const TEST_DIR = path.join(os.tmpdir(), "testWorkspaceDir");

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

/*
  accepts array of items in 3 formats, e.g.
  "index/" creates index directory
  "index/index.ts" creates an empty index/index.ts
  ["index/index.ts", "hello"] creates index/index.ts with contents "hello"
*/
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
