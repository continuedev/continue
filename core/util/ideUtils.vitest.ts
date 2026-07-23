import { describe, expect, it, vi } from "vitest";
import { IDE } from "..";
import {
  inferResolvedUriFromRelativePath,
  normalizeDirUri,
  resolveRelativePathInDir,
} from "./ideUtils";

describe("normalizeDirUri", () => {
  it("should pass through file:// URIs unchanged", () => {
    expect(normalizeDirUri("file:///home/user/project")).toBe(
      "file:///home/user/project",
    );
  });

  it("should convert Linux absolute path to file:// URI", () => {
    expect(normalizeDirUri("/home/user/project")).toBe("file:///home/user/project");
  });

  it("should encode special characters in Linux paths", () => {
    expect(normalizeDirUri("/home/user/my project")).toBe("file:///home/user/my%20project");
  });

  it("should convert Windows drive path to file:// URI", () => {
    expect(normalizeDirUri("C:\\Users\\user\\project")).toBe("file:///C%3A/Users/user/project");
  });
});

function createMockIde(opts: {
  workspaceDirs: string[];
  existingFiles?: Set<string>;
}): IDE {
  const existingFiles = opts.existingFiles ?? new Set<string>();
  return {
    getWorkspaceDirs: vi.fn(async () => opts.workspaceDirs),
    fileExists: vi.fn(async (uri: string) => existingFiles.has(uri)),
  } as unknown as IDE;
}

describe("resolveRelativePathInDir", () => {
  it("should resolve a relative path against a proper file:// workspace dir", async () => {
    const ide = createMockIde({
      workspaceDirs: ["file:///home/user/project"],
      existingFiles: new Set(["file:///home/user/project/src/file.ts"]),
    });
    const result = await resolveRelativePathInDir("src/file.ts", ide);
    expect(result).toBe("file:///home/user/project/src/file.ts");
  });

  it("should resolve when workspace dir is a plain Linux path (bug #11559)", async () => {
    const ide = createMockIde({
      workspaceDirs: ["/home/user/project"],
      existingFiles: new Set(["file:///home/user/project/src/file.ts"]),
    });
    const result = await resolveRelativePathInDir("src/file.ts", ide);
    expect(result).toBe("file:///home/user/project/src/file.ts");
  });

  it("should NOT produce a double-prefixed path (regression guard)", async () => {
    const ide = createMockIde({
      workspaceDirs: ["/home/user/project"],
      existingFiles: new Set(["file:///home/user/project/src/file.ts"]),
    });
    const result = await resolveRelativePathInDir("src/file.ts", ide);
    expect(result).not.toContain("/home/user/home/");
  });
});

describe("inferResolvedUriFromRelativePath", () => {
  it("should join relative path to normalized workspace dir", async () => {
    const ide = createMockIde({
      workspaceDirs: ["file:///home/user/project"],
    });
    const result = await inferResolvedUriFromRelativePath("src/file.ts", ide);
    expect(result).toBe("file:///home/user/project/src/file.ts");
  });

  it("should produce correct URI when workspace dir is plain path (bug #11559)", async () => {
    const ide = createMockIde({
      workspaceDirs: ["/home/user/project"],
    });
    const result = await inferResolvedUriFromRelativePath("src/file.ts", ide);
    expect(result).toBe("file:///home/user/project/src/file.ts");
  });

  it("should NOT produce double-prefixed path (regression guard)", async () => {
    const ide = createMockIde({
      workspaceDirs: ["/home/user/project"],
    });
    const result = await inferResolvedUriFromRelativePath("src/file.ts", ide);
    expect(result).not.toContain("/home/user/home/");
  });
});
