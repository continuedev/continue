import path from "path";

import { shouldChunk } from "./chunk";

describe("shouldChunk", () => {
  test("should chunk a typescript file", () => {
    const filePath = path.join("directory", "file.ts");
    const fileContent = generateString(10000);
    expect(shouldChunk(path.sep, filePath, fileContent)).toBe(true);
  });

  test("should not chunk a large typescript file", () => {
    const filePath = path.join("directory", "file.ts");
    const fileContent = generateString(1500000);
    expect(shouldChunk(path.sep, filePath, fileContent)).toBe(false);
  });

  test("should not chunk an empty file", () => {
    const filePath = path.join("directory", "file.ts");
    const fileContent = generateString(0);
    expect(shouldChunk(path.sep, filePath, fileContent)).toBe(false);
  });

  test("should not chunk a file without extension", () => {
    const filePath = path.join("directory", "with.dot", "filename");
    const fileContent = generateString(10000);
    expect(shouldChunk(path.sep, filePath, fileContent)).toBe(false);
  });
});

function generateString(length: number) {
  return "a".repeat(length);
}
