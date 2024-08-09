import { shouldChunk } from "../../../indexing/chunk/chunk";
import path from "path";

describe("shouldChunk", () => {
    test("should chunk a typescript file", () => {
        const filePath = "directory/file.ts";
        const fileContent = generateString(10000);
        expect(shouldChunk(path.sep, filePath, fileContent)).toBe(true);
    });

    test("should not chunk a large typescript file", () => {
        const filePath = "directory/file.ts";
        const fileContent = generateString(1500000);
        expect(shouldChunk(path.sep, filePath, fileContent)).toBe(false);
    });

    test("should not chunk an empty file", () => {
        const filePath = "directory/file.ts";
        const fileContent = generateString(0);
        expect(shouldChunk(path.sep, filePath, fileContent)).toBe(false);
    });

    test("should not chunk a file without extension", () => {
        const filePath = "directory/with.dot/filename";
        const fileContent = generateString(10000);
        expect(shouldChunk(path.sep, filePath, fileContent)).toBe(false);
    });
});

function generateString(length: number) {
    return "a".repeat(length);
}