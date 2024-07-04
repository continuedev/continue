import fs from "fs";
import path from "path";
import { walkDir } from "../indexing/walkDir";
import FileSystemIde from "../util/filesystem";
const ide = new FileSystemIde();

const TEST_DIR = path.join(__dirname, "testDir");

function buildTestDir(paths: (string | string[])[]) {
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

async function walkTestDir(): Promise<string[] | undefined> {
  const result = await new Promise<string[] | undefined>((resolve, reject) =>
    walkDir(
      {
        path: TEST_DIR,
        ignoreFiles: [".gitignore"],
      },
      ide,
      (err, result) => {
        if (err) {
          reject(err);
        }
        resolve(result);
      },
    ),
  );
  return result;
}

async function expectPaths(toExist: string[], toNotExist: string[]) {
  const result = await walkTestDir();

  for (const p of toExist) {
    expect(result).toContain(p);
  }
  for (const p of toNotExist) {
    expect(result).not.toContain(p);
  }
}

describe("walkDir", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR);
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true });
  });

  test("should return nothing for empty dir", async () => {
    const result = await walkTestDir();
    expect(result).toEqual([]);
  });

  test("should return all files in flat dir", async () => {
    const files = ["a.txt", "b.py", "c.ts"];
    buildTestDir(files);
    const result = await walkTestDir();
    expect(result).toEqual(files);
  });

  test("should ignore ignored files in flat dir", async () => {
    const files = [[".gitignore", "*.py"], "a.txt", "c.ts", "b.py"];
    buildTestDir(files);
    await expectPaths(["a.txt", "c.ts", ".gitignore"], ["b.py"]);
  });

  test("should handle negation in flat folder", async () => {
    const files = [[".gitignore", "**/*\n!*.py"], "a.txt", "c.ts", "b.py"];
    buildTestDir(files);
    await expectPaths(["b.py"], [".gitignore", "a.txt", "c.ts"]);
  });

  test("should get all files in nested folder structure", async () => {
    const files = [
      "a.txt",
      "b.py",
      "c.ts",
      "d/",
      "d/e.txt",
      "d/f.py",
      "d/g/",
      "d/g/h.ts",
    ];
    buildTestDir(files);
    await expectPaths(
      files.filter((files) => !files.endsWith("/")),
      [],
    );
  });

  test("should ignore ignored files in nested folder structure", async () => {
    const files = [
      "a.txt",
      "b.py",
      "c.ts",
      "d/",
      "d/e.txt",
      "d/f.py",
      "d/g/",
      "d/g/h.ts",
      ["d/.gitignore", "*.py"],
    ];
    buildTestDir(files);
    await expectPaths(
      ["a.txt", "b.py", "c.ts", "d/e.txt", "d/g/h.ts", "d/.gitignore"],
      ["d/f.py"],
    );
  });

  test("should handle leading slash in gitignore", async () => {
    const files = [[".gitignore", "/no.txt"], "a.txt", "b.py", "no.txt"];
    buildTestDir(files);
    await expectPaths(["a.txt", "b.py"], ["no.txt"]);
  });
});
