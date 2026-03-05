import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { ContinueErrorReason } from "core/util/errors.js";

import { readFileTool } from "./readFile.js";
import {
  extractTextFromToolResult,
  isMultipartToolResult,
} from "./types.js";

describe("readFileTool - image support", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "readfile-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return a string for text files", async () => {
    const filePath = path.join(tmpDir, "test.txt");
    fs.writeFileSync(filePath, "hello world");

    const result = await readFileTool.run({ filepath: filePath });
    expect(typeof result).toBe("string");
    expect(result as string).toContain("hello world");
  });

  it("should return a multipart result for PNG files", async () => {
    // Create a minimal valid PNG (1x1 pixel, white)
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, // IHDR chunk length
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, // width: 1
      0x00, 0x00, 0x00, 0x01, // height: 1
      0x08, 0x02, // bit depth: 8, color type: 2 (RGB)
      0x00, 0x00, 0x00, // compression, filter, interlace
      0x90, 0x77, 0x53, 0xde, // IHDR CRC
      0x00, 0x00, 0x00, 0x0c, // IDAT chunk length
      0x49, 0x44, 0x41, 0x54, // IDAT
      0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x02, 0x00,
      0x01, // compressed data
      0xe2, 0x21, 0xbc, 0x33, // IDAT CRC
      0x00, 0x00, 0x00, 0x00, // IEND chunk length
      0x49, 0x45, 0x4e, 0x44, // IEND
      0xae, 0x42, 0x60, 0x82, // IEND CRC
    ]);

    const filePath = path.join(tmpDir, "test.png");
    fs.writeFileSync(filePath, pngHeader);

    const result = await readFileTool.run({ filepath: filePath });
    expect(isMultipartToolResult(result)).toBe(true);

    if (isMultipartToolResult(result)) {
      // Should have a text part and an image part
      const textParts = result.parts.filter((p) => p.type === "text");
      const imageParts = result.parts.filter((p) => p.type === "image");

      expect(textParts.length).toBe(1);
      expect(imageParts.length).toBe(1);

      expect(textParts[0].text).toContain("test.png");
      expect(imageParts[0].data).toBeTruthy();
      expect(imageParts[0].mimeType).toMatch(/^image\//);
    }
  });

  it("should return a multipart result for JPEG files", async () => {
    // Create a minimal JPEG-like buffer
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
    ]);

    const filePath = path.join(tmpDir, "test.jpg");
    fs.writeFileSync(filePath, jpegBuffer);

    const result = await readFileTool.run({ filepath: filePath });
    expect(isMultipartToolResult(result)).toBe(true);

    if (isMultipartToolResult(result)) {
      const imagePart = result.parts.find((p) => p.type === "image");
      expect(imagePart).toBeDefined();
      expect(imagePart!.mimeType).toMatch(/^image\/(jpeg|png)/);
    }
  });

  it("should extract text from multipart results", async () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
      0x00,
    ]);

    const filePath = path.join(tmpDir, "photo.png");
    fs.writeFileSync(filePath, pngBuffer);

    const result = await readFileTool.run({ filepath: filePath });
    const text = extractTextFromToolResult(result);
    expect(text).toContain("photo.png");
    expect(text).toContain("image/");
  });

  it("should reject oversized image files", async () => {
    // Create a file larger than 10MB
    const filePath = path.join(tmpDir, "huge.png");
    // Write PNG header + padding to exceed limit
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const padding = Buffer.alloc(11 * 1024 * 1024); // 11MB
    fs.writeFileSync(filePath, Buffer.concat([pngHeader, padding]));

    await expect(readFileTool.run({ filepath: filePath })).rejects.toThrow(
      /too large/,
    );
  });

  it("should read SVG files as text (not image)", async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const filePath = path.join(tmpDir, "icon.svg");
    fs.writeFileSync(filePath, svgContent);

    const result = await readFileTool.run({ filepath: filePath });
    expect(typeof result).toBe("string");
    expect(result as string).toContain("<svg");
  });

  it("should handle nonexistent files", async () => {
    await expect(
      readFileTool.run({ filepath: path.join(tmpDir, "nope.png") }),
    ).rejects.toThrow(/does not exist/);
  });
});
