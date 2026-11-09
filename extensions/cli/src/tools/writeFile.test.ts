import * as fs from "fs";
import * as path from "path";

import { ContinueError } from "core/util/errors.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { writeFileTool } from "./writeFile.js";

const headless = vi.hoisted(() => ({ value: false }));
vi.mock("../services/index.js", () => ({
  services: { toolPermissions: { isHeadless: () => headless.value } },
}));
vi.mock("../telemetry/telemetryService.js");
vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

describe("writeFileTool and the working directory", () => {
  // Beside the working directory, as the path Nova Pro copied with one hex
  // digit wrong was
  const outsidePath = path.resolve(process.cwd(), "..", "elsewhere", "a.txt");

  beforeEach(() => {
    vi.clearAllMocks();
    headless.value = false;
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    headless.value = false;
  });

  it("resolves a relative path against the working directory and keeps the preview as it was", async () => {
    const result = await writeFileTool.preprocess!({
      filepath: "notes/a.txt",
      content: "one\ntwo",
    });
    expect(result.args.filepath).toBe(
      path.join(process.cwd(), "notes", "a.txt"),
    );
    expect(result.preview?.[0]).toEqual({
      type: "text",
      content: "New file content:",
    });
  });

  it("says in the preview when the target is outside the working directory", async () => {
    const result = await writeFileTool.preprocess!({
      filepath: outsidePath,
      content: "x",
    });
    expect(result.preview?.[0]).toMatchObject({
      type: "text",
      content: expect.stringContaining("Outside the working directory"),
    });
    expect(result.preview?.[0].content).toContain(outsidePath);
    expect(result.preview?.[1]).toEqual({
      type: "text",
      content: "New file content:",
    });
  });

  it("refuses such a write in a headless run, naming the path and the working directory", async () => {
    headless.value = true;
    const error = await writeFileTool.preprocess!({
      filepath: outsidePath,
      content: "x",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ContinueError);
    expect(error.message).toContain("Write was not run");
    expect(error.message).toContain(outsidePath);
    expect(error.message).toContain(process.cwd());
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it("allows a headless write under the Continue home folder", async () => {
    headless.value = true;
    const { env } = await import("../env.js");
    const target = path.join(env.continueHome, "skills", "x.md");
    const result = await writeFileTool.preprocess!({
      filepath: target,
      content: "x",
    });
    expect(result.args.filepath).toBe(target);
    expect(result.preview?.[0]).toEqual({
      type: "text",
      content: "New file content:",
    });
  });

  it("the description tells the model to use it instead of a shell redirect", () => {
    expect(writeFileTool.description).toContain(
      "Use this tool for every file write",
    );
    expect(writeFileTool.description).toContain(
      "counts as a file edit and is refused",
    );
  });
});
