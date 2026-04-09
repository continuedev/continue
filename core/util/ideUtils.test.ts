import { IDE } from "..";
import {
  inferResolvedUriFromRelativePath,
  resolveRelativePathInDir,
} from "./ideUtils";

type CurrentFile = Awaited<ReturnType<IDE["getCurrentFile"]>>;

function createMockIde(options: {
  workspaceDirs: string[];
  existingUris?: string[];
  currentFile?: CurrentFile;
}): IDE {
  const existingUris = new Set(options.existingUris ?? []);

  return {
    getWorkspaceDirs: jest.fn().mockResolvedValue(options.workspaceDirs),
    fileExists: jest
      .fn()
      .mockImplementation(async (uri: string) => existingUris.has(uri)),
    getCurrentFile: jest.fn().mockResolvedValue(options.currentFile),
  } as unknown as IDE;
}

describe("ideUtils", () => {
  test("resolveRelativePathInDir prefers the current file workspace when multiple matches exist", async () => {
    const ide = createMockIde({
      workspaceDirs: [
        "file:///workspace/project1",
        "file:///workspace/project2",
      ],
      existingUris: [
        "file:///workspace/project1/pom.xml",
        "file:///workspace/project2/pom.xml",
      ],
      currentFile: {
        isUntitled: false,
        path: "file:///workspace/project2/src/main/java/App.java",
        contents: "",
      },
    });

    await expect(resolveRelativePathInDir("pom.xml", ide)).resolves.toBe(
      "file:///workspace/project2/pom.xml",
    );
  });

  test("inferResolvedUriFromRelativePath prefers the current file workspace when no unique match exists", async () => {
    const ide = createMockIde({
      workspaceDirs: [
        "file:///workspace/project1",
        "file:///workspace/project2",
        "file:///workspace/project3",
      ],
      currentFile: {
        isUntitled: false,
        path: "file:///workspace/project2/src/main/java/App.java",
        contents: "",
      },
    });

    await expect(
      inferResolvedUriFromRelativePath("src/main/java/NewFile.java", ide),
    ).resolves.toBe("file:///workspace/project2/src/main/java/NewFile.java");
  });

  test("inferResolvedUriFromRelativePath keeps the original first-workspace fallback when there is no active file", async () => {
    const ide = createMockIde({
      workspaceDirs: [
        "file:///workspace/project1",
        "file:///workspace/project2",
      ],
    });

    await expect(
      inferResolvedUriFromRelativePath("src/main/java/NewFile.java", ide),
    ).resolves.toBe("file:///workspace/project1/src/main/java/NewFile.java");
  });

  test("resolveRelativePathInDir falls back cleanly when getCurrentFile is unavailable at runtime", async () => {
    const ide = {
      getWorkspaceDirs: jest.fn().mockResolvedValue([
        "file:///workspace/project1",
        "file:///workspace/project2",
      ]),
      fileExists: jest.fn().mockImplementation(async (uri: string) =>
        uri === "file:///workspace/project1/pom.xml",
      ),
    } as unknown as IDE;

    await expect(resolveRelativePathInDir("pom.xml", ide)).resolves.toBe(
      "file:///workspace/project1/pom.xml",
    );
  });
});
