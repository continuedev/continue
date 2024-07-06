import fs from "fs";
import path from "path";

export const TEST_DIR = path.join(__dirname, "testDir");

export function setUpTestDir() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR);
}

export function tearDownTestDir() {
  fs.rmSync(TEST_DIR, { recursive: true });
}

export function addToTestDir(paths: (string | string[])[]) {
  for (const p of paths) {
    if (Array.isArray(p)) {
      fs.writeFileSync(path.join(TEST_DIR, p[0]), p[1]);
    } else if (p.endsWith("/")) {
      fs.mkdirSync(path.join(TEST_DIR, p), { recursive: true });
    } else {
      fs.writeFileSync(path.join(TEST_DIR, p), "");
    }
  }
}
