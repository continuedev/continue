import {
  getLastNPathParts,
  getRelativePath,
  getUniqueUriPath,
  getUriPathBasename,
  groupByLastNPathParts,
  splitUriPath,
} from "./uri";

describe("getUriPathBasename", () => {
  it("should return the base name of a Unix-style path", () => {
    const filepath = "/home/user/documents/file.txt";
    const output = getUriPathBasename(filepath);
    expect(output).toBe("file.txt");
  });

  it("should return the base name of a Windows-style path", () => {
    const filepath = "C:\\Users\\User\\Documents\\file.txt";
    const output = getUriPathBasename(filepath);
    expect(output).toBe("file.txt");
  });

  it("should handle paths with mixed separators", () => {
    const filepath = "C:/Users\\User/Documents/file.txt";
    const output = getUriPathBasename(filepath);
    expect(output).toBe("file.txt");
  });

  it("should return an empty string for empty input", () => {
    const filepath = "";
    const output = getUriPathBasename(filepath);
    expect(output).toBe("");
  });
});

describe("groupByLastNPathParts", () => {
  it("should group filepaths by their last N parts", () => {
    const filepaths = [
      "/a/b/c/d/file1.txt",
      "/x/y/z/file1.txt",
      "/a/b/c/d/file2.txt",
    ];
    const output = groupByLastNPathParts(filepaths, 2);
    expect(output).toEqual({
      "d/file1.txt": ["/a/b/c/d/file1.txt"],
      "z/file1.txt": ["/x/y/z/file1.txt"],
      "d/file2.txt": ["/a/b/c/d/file2.txt"],
    });
  });

  it("should handle an empty array", () => {
    const filepaths: string[] = [];
    const output = groupByLastNPathParts(filepaths, 2);
    expect(output).toEqual({});
  });

  it("should handle N greater than path parts", () => {
    const filepaths = ["/file.txt"];
    const output = groupByLastNPathParts(filepaths, 5);
    expect(output).toEqual({ "/file.txt": ["/file.txt"] });
  });
});

describe("getUniqueUriPath", () => {
  it("should return a unique file path within the group", () => {
    const item = "/a/b/c/file.txt";
    const itemGroups = {
      "c/file.txt": ["/a/b/c/file.txt", "/x/y/c/file.txt"],
    };
    const output = getUniqueUriPath(item, itemGroups);
    expect(output).toBe("b/c/file.txt");
  });

  it("should return the last two parts if unique", () => {
    const item = "/a/b/c/file.txt";
    const itemGroups = {
      "c/file.txt": ["/a/b/c/file.txt"],
    };
    const output = getUniqueUriPath(item, itemGroups);
    expect(output).toBe("c/file.txt");
  });

  it("should handle when additional parts are needed to make it unique", () => {
    const item = "/a/b/c/d/e/file.txt";
    const itemGroups = {
      "e/file.txt": ["/a/b/c/d/e/file.txt", "/x/y/z/e/file.txt"],
    };
    const output = getUniqueUriPath(item, itemGroups);
    expect(output).toBe("d/e/file.txt");
  });
});

describe("splitUriPath", () => {
  it("should split Unix-style paths", () => {
    const path = "/a/b/c/d/e.txt";
    const output = splitUriPath(path);
    expect(output).toEqual(["", "a", "b", "c", "d", "e.txt"]);
  });

  it("should split Windows-style paths", () => {
    const path = "C:\\Users\\User\\Documents\\file.txt";
    const output = splitUriPath(path);
    expect(output).toEqual(["C:", "Users", "User", "Documents", "file.txt"]);
  });

  it("should handle empty path", () => {
    const path = "";
    const output = splitUriPath(path);
    expect(output).toEqual([""]);
  });

  it("should handle paths with multiple consecutive separators", () => {
    const path = "/a//b/c/d/e.txt";
    const output = splitUriPath(path);
    expect(output).toEqual(["", "a", "", "b", "c", "d", "e.txt"]);
  });
});

describe("getRelativePath", () => {
  it("should return the relative path with respect to workspace directories", () => {
    const filepath = "/workspace/project/src/file.ts";
    const workspaceDirs = ["/workspace/project"];
    const output = getRelativePath(filepath, workspaceDirs);
    expect(output).toBe("src/file.ts");
  });

  it("should return the filename if not in any workspace", () => {
    const filepath = "/other/place/file.ts";
    const workspaceDirs = ["/workspace/project"];
    const output = getRelativePath(filepath, workspaceDirs);
    expect(output).toBe("file.ts");
  });

  it("should handle multiple workspace directories", () => {
    const filepath = "/workspace2/project/src/file.ts";
    const workspaceDirs = ["/workspace/project", "/workspace2/project"];
    const output = getRelativePath(filepath, workspaceDirs);
    expect(output).toBe("src/file.ts");
  });

  it("should handle Windows-style paths", () => {
    const filepath = "C:\\workspace\\project\\src\\file.ts";
    const workspaceDirs = ["C:\\workspace\\project"];
    const output = getRelativePath(filepath, workspaceDirs);
    expect(output).toBe("src/file.ts");
  });

  it("should handle paths with spaces or special characters", () => {
    const filepath = "/workspace/project folder/src/file.ts";
    const workspaceDirs = ["/workspace/project folder"];
    const output = getRelativePath(filepath, workspaceDirs);
    expect(output).toBe("src/file.ts");
  });
});

describe("getLastNPathParts", () => {
  test("returns the last N parts of a filepath with forward slashes", () => {
    const filepath = "home/user/documents/project/file.txt";
    expect(getLastNPathParts(filepath, 2)).toBe("project/file.txt");
  });

  test("returns the last N parts of a filepath with backward slashes", () => {
    const filepath = "C:\\home\\user\\documents\\project\\file.txt";
    expect(getLastNPathParts(filepath, 3)).toBe("documents/project/file.txt");
  });

  test("returns the last part if N is 1", () => {
    const filepath = "/home/user/documents/project/file.txt";
    expect(getLastNPathParts(filepath, 1)).toBe("file.txt");
  });

  test("returns the entire path if N is greater than the number of parts", () => {
    const filepath = "home/user/documents/project/file.txt";
    expect(getLastNPathParts(filepath, 10)).toBe(
      "home/user/documents/project/file.txt",
    );
  });

  test("returns an empty string if N is 0", () => {
    const filepath = "home/user/documents/project/file.txt";
    expect(getLastNPathParts(filepath, 0)).toBe("");
  });

  test("handles paths with mixed forward and backward slashes", () => {
    const filepath = "home\\user/documents\\project/file.txt";
    expect(getLastNPathParts(filepath, 3)).toBe("documents/project/file.txt");
  });

  test("handles edge case with empty filepath", () => {
    const filepath = "";
    expect(getLastNPathParts(filepath, 2)).toBe("");
  });
});

describe("shortestRelativePaths", () => {
  it("should return shortest unique paths", () => {
    const paths = [
      "/a/b/c/file.txt",
      "/a/b/d/file.txt",
      "/a/b/d/file2.txt",
      "/x/y/z/file.txt",
    ];
    const output = shortestRelativePaths(paths);
    expect(output).toEqual([
      "c/file.txt",
      "d/file.txt",
      "file2.txt",
      "z/file.txt",
    ]);
  });

  it("should handle empty array", () => {
    const paths: string[] = [];
    const output = shortestRelativePaths(paths);
    expect(output).toEqual([]);
  });

  it("should handle paths with same base names", () => {
    const paths = [
      "/a/b/c/d/file.txt",
      "/a/b/c/e/file.txt",
      "/a/b/f/g/h/file.txt",
    ];
    const output = shortestRelativePaths(paths);
    expect(output).toEqual(["d/file.txt", "e/file.txt", "h/file.txt"]);
  });

  it("should handle paths where entire path is needed", () => {
    const paths = ["/a/b/c/file.txt", "/a/b/c/file.txt", "/a/b/c/file.txt"];
    const output = shortestRelativePaths(paths);
    expect(output).toEqual(["file.txt", "file.txt", "file.txt"]);
  });
});
