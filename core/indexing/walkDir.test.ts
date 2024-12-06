import path from "path";

import { walkDir, WalkerOptions } from "../indexing/walkDir";
import {
  TEST_DIR,
  setUpTestDir,
  tearDownTestDir,
  addToTestDir,
} from "../test/testDir";
import FileSystemIde from "../util/filesystem";

const ide = new FileSystemIde(TEST_DIR);

async function walkTestDir(
  options?: WalkerOptions,
): Promise<string[] | undefined> {
  return walkDir(TEST_DIR, ide, {
    returnRelativePaths: true,
    ...options,
  });
}

async function expectPaths(
  toExist: string[],
  toNotExist: string[],
  options?: WalkerOptions,
) {
  // Convert to Windows paths
  const pathSep = await ide.pathSep();
  if (pathSep === "\\") {
    toExist = toExist.map((p) => p.replace(/\//g, "\\"));
    toNotExist = toNotExist.map((p) => p.replace(/\//g, "\\"));
  }

  const result = await walkTestDir(options);

  for (const p of toExist) {
    expect(result).toContain(p);
  }
  for (const p of toNotExist) {
    expect(result).not.toContain(p);
  }
}

describe("walkDir", () => {
  beforeEach(() => {
    setUpTestDir();
  });

  afterEach(() => {
    tearDownTestDir();
  });

  test("should return nothing for empty dir", async () => {
    const result = await walkTestDir();
    expect(result).toEqual([]);
  });

  test("should return all files in flat dir", async () => {
    const files = ["a.txt", "b.py", "c.ts"];
    addToTestDir(files);
    const result = await walkTestDir();
    expect(result).toEqual(files);
  });

  test("should ignore ignored files in flat dir", async () => {
    const files = [[".gitignore", "*.py"], "a.txt", "c.ts", "b.py"];
    addToTestDir(files);
    await expectPaths(["a.txt", "c.ts"], ["b.py"]);
  });

  test("should handle negation in flat folder", async () => {
    const files = [[".gitignore", "**/*\n!*.py"], "a.txt", "c.ts", "b.py"];
    addToTestDir(files);
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
    addToTestDir(files);
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
    addToTestDir(files);
    await expectPaths(
      ["a.txt", "b.py", "c.ts", "d/e.txt", "d/g/h.ts"],
      ["d/f.py"],
    );
  });

  test("should use gitignore in parent directory for subdirectory", async () => {
    const files = [
      "a.txt",
      "b.py",
      "d/",
      "d/e.txt",
      "d/f.py",
      "d/g/",
      "d/g/h.ts",
      "d/g/i.py",
      [".gitignore", "*.py"],
    ];
    addToTestDir(files);
    await expectPaths(["a.txt", "d/e.txt", "d/g/h.ts"], ["d/f.py", "d/g/i.py"]);
  });

  test("should handle leading slash in gitignore", async () => {
    const files = [[".gitignore", "/no.txt"], "a.txt", "b.py", "no.txt"];
    addToTestDir(files);
    await expectPaths(["a.txt", "b.py"], ["no.txt"]);
  });

  test("should not ignore leading slash when in subfolder", async () => {
    const files = [
      [".gitignore", "/no.txt"],
      "a.txt",
      "b.py",
      "no.txt",
      "sub/",
      "sub/no.txt",
    ];
    addToTestDir(files);
    await expectPaths(["a.txt", "b.py", "sub/no.txt"], ["no.txt"]);
  });

  test("should handle multiple .gitignore files in nested structure", async () => {
    const files = [
      [".gitignore", "*.txt"],
      "a.py",
      "b.txt",
      "c/",
      "c/d.txt",
      "c/e.py",
      ["c/.gitignore", "*.py"],
    ];
    addToTestDir(files);
    await expectPaths(["a.py"], ["b.txt", "c/e.py", "c/d.txt"]);
  });

  test("should handle wildcards in .gitignore", async () => {
    const files = [
      [".gitignore", "*.txt\n*.py"],
      "a.txt",
      "b.py",
      "c.ts",
      "d/",
      "d/e.txt",
      "d/f.py",
      "d/g.ts",
    ];
    addToTestDir(files);
    await expectPaths(
      ["c.ts", "d/g.ts"],
      ["a.txt", "b.py", "d/e.txt", "d/f.py"],
    );
  });

  test("should handle directory ignores in .gitignore", async () => {
    const files = [
      [".gitignore", "ignored_dir/"],
      "a.txt",
      "ignored_dir/",
      "ignored_dir/b.txt",
      "ignored_dir/c/",
      "ignored_dir/c/d.py",
    ];
    addToTestDir(files);
    await expectPaths(["a.txt"], ["ignored_dir/b.txt", "ignored_dir/c/d.py"]);
  });

  test("gitignore in sub directory should only apply to subdirectory", async () => {
    const files = [
      [".gitignore", "abc"],
      "a.txt",
      "abc",
      "xyz/",
      ["xyz/.gitignore", "xyz"],
      "xyz/b.txt",
      "xyz/c/",
      "xyz/c/d.py",
      "xyz/xyz",
    ];
    addToTestDir(files);
    await expectPaths(["a.txt", "xyz/b.txt", "xyz/c/d.py"], ["abc", "xyz/xyz"]);
  });

  test("should handle complex patterns in .gitignore", async () => {
    const files = [
      [".gitignore", "*.what\n!important.what\ntemp/\n/root_only.txt"],
      "a.what",
      "important.what",
      "root_only.txt",
      "subdir/",
      "subdir/root_only.txt",
      "subdir/b.what",
      "temp/",
      "temp/c.txt",
    ];
    addToTestDir(files);
    await expectPaths(
      ["important.what", "subdir/root_only.txt"],
      ["a.what", "root_only.txt", "subdir/b.what", "temp/c.txt"],
    );
  });

  test("should listen to both .gitignore and .continueignore", async () => {
    const files = [
      [".gitignore", "*.py"],
      [".continueignore", "*.ts"],
      "a.txt",
      "b.py",
      "c.ts",
      "d.js",
    ];
    addToTestDir(files);
    await expectPaths(["a.txt", "d.js"], ["b.py", "c.ts"]);
  });

  test("should return dirs and only dirs in onlyDirs mode", async () => {
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
    addToTestDir(files);
    await expectPaths(
      ["d", "d/g"],
      ["a.txt", "b.py", "c.ts", "d/e.txt", "d/f.py", "d/g/h.ts"],
      { onlyDirs: true },
    );
  });

  test("should return valid paths in absolute path mode", async () => {
    const files = ["a.txt", "b/", "b/c.txt"];
    addToTestDir(files);
    await expectPaths(
      [path.join(TEST_DIR, "a.txt"), path.join(TEST_DIR, "b", "c.txt")],
      [],
      {
        returnRelativePaths: false,
      },
    );
  });

  test("should skip .git and node_modules folders", async () => {
    const files = [
      "a.txt",
      ".git/",
      ".git/config",
      ".git/HEAD",
      ".git/objects/",
      ".git/objects/1234567890abcdef",
      "node_modules/",
      "node_modules/package/",
      "node_modules/package/index.js",
      "src/",
      "src/index.ts",
    ];
    addToTestDir(files);
    await expectPaths(
      ["a.txt", "src/index.ts"],
      [
        ".git/config",
        ".git/HEAD",
        "node_modules/package/index.js",
        ".git/objects/1234567890abcdef",
      ],
    );
  });

  test("should walk continue repo without getting any files of the default ignore types", async () => {
    const results = await walkDir(path.join(__dirname, ".."), ide, {
      ignoreFiles: [".gitignore", ".continueignore"],
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((file) => file.includes("/node_modules/"))).toBe(false);
    expect(results.some((file) => file.includes("/.git/"))).toBe(false);
    expect(
      results.some(
        (file) =>
          file.endsWith(".gitignore") ||
          file.endsWith(".continueignore") ||
          file.endsWith("package-lock.json"),
      ),
    ).toBe(false);
    // At some point we will cross this number, but in case we leap past it suddenly I think we'd want to investigate why
    expect(results.length).toBeLessThan(1500);
  });

  // This test is passing when this file is ran individually, but failing with `directory not found` error
  // when the full test suite is ran
  test.skip("should walk continue/extensions/vscode without getting any files in the .continueignore", async () => {
    const vscodePath = path.join(__dirname, "../..", "extensions", "vscode");
    const results = await walkDir(vscodePath, ide, {
      ignoreFiles: [".gitignore", ".continueignore"],
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((file) => file.includes("/textmate-syntaxes/"))).toBe(
      false,
    );
    expect(results.some((file) => file.includes(".tmLanguage"))).toBe(false);
  });

  // This test is passing when this file is ran individually, but failing with `jest not found` error
  // when the full test suite is ran
  test.skip("should perform the same number of dir reads as 1 + the number of dirs that contain files", async () => {
    const files = [
      "a.txt",
      "b.py",
      "c.ts",
      "d/",
      "d/e.txt",
      "d/f.py",
      "d/g/",
      "d/g/h.ts",
      "d/g/i/",
      "d/g/i/j.ts",
    ];

    const numDirs = files.filter((file) => !file.includes(".")).length;
    const numDirsPlusTopLevelRead = numDirs + 1;

    addToTestDir(files);

    const mockListDir = jest.spyOn(ide, "listDir");

    await walkTestDir();

    expect(mockListDir).toHaveBeenCalledTimes(numDirsPlusTopLevelRead);
  });
});
