import { TEST_DIR } from "../test/testDir";
import { getLastNPathParts, getUriPathBasename } from "./uri";

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
