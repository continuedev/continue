import { detectImageFormat, formatFileSize, isImageFile } from "./image.js";

describe("isImageFile", () => {
  it("should detect common image extensions", () => {
    expect(isImageFile("photo.png")).toBe(true);
    expect(isImageFile("photo.jpg")).toBe(true);
    expect(isImageFile("photo.jpeg")).toBe(true);
    expect(isImageFile("photo.gif")).toBe(true);
    expect(isImageFile("photo.webp")).toBe(true);
    expect(isImageFile("photo.bmp")).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(isImageFile("photo.PNG")).toBe(true);
    expect(isImageFile("photo.JPG")).toBe(true);
    expect(isImageFile("photo.Jpeg")).toBe(true);
  });

  it("should handle paths with directories", () => {
    expect(isImageFile("src/assets/logo.png")).toBe(true);
    expect(isImageFile("/absolute/path/to/image.jpg")).toBe(true);
    expect(isImageFile("./relative/path.webp")).toBe(true);
  });

  it("should not match non-image files", () => {
    expect(isImageFile("readme.md")).toBe(false);
    expect(isImageFile("index.ts")).toBe(false);
    expect(isImageFile("data.json")).toBe(false);
    expect(isImageFile("styles.css")).toBe(false);
  });

  it("should not match SVG (text-based, handled as text)", () => {
    expect(isImageFile("icon.svg")).toBe(false);
  });

  it("should not match files without extensions", () => {
    expect(isImageFile("Makefile")).toBe(false);
    expect(isImageFile("Dockerfile")).toBe(false);
  });
});

describe("detectImageFormat", () => {
  it("should detect JPEG from header", () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(detectImageFormat(jpegBuffer)).toBe("image/jpeg");
  });

  it("should detect PNG from header", () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]);
    expect(detectImageFormat(pngBuffer)).toBe("image/png");
  });

  it("should detect GIF from header", () => {
    const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39]);
    expect(detectImageFormat(gifBuffer)).toBe("image/gif");
  });

  it("should detect WebP from header", () => {
    // RIFF....WEBP
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
      0x50,
    ]);
    expect(detectImageFormat(webpBuffer)).toBe("image/webp");
  });

  it("should detect BMP from header", () => {
    const bmpBuffer = Buffer.from([0x42, 0x4d, 0x00, 0x00, 0x00]);
    expect(detectImageFormat(bmpBuffer)).toBe("image/bmp");
  });

  it("should default to image/png for unknown formats", () => {
    const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(detectImageFormat(unknownBuffer)).toBe("image/png");
  });

  it("should default to image/png for tiny buffers", () => {
    const tinyBuffer = Buffer.from([0x00]);
    expect(detectImageFormat(tinyBuffer)).toBe("image/png");
  });
});

describe("formatFileSize", () => {
  it("should format bytes", () => {
    expect(formatFileSize(500)).toBe("500B");
  });

  it("should format kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2KB");
  });

  it("should format megabytes", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0MB");
  });
});
