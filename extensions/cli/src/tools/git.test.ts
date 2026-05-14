import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("child_process", () => {
  const execFile = Object.assign(execFileMock, {
    [Symbol.for("nodejs.util.promisify.custom")]: (
      file: string,
      args: string[],
      options: Record<string, unknown>,
    ) =>
      new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        execFileMock(
          file,
          args,
          options,
          (error: Error | null, stdout: string = "", stderr: string = "") => {
            if (error) {
              reject(Object.assign(error, { stdout, stderr }));
              return;
            }

            resolve({ stdout, stderr });
          },
        );
      }),
  });

  return { execFile };
});

describe("Git tool", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("formats status output and normalizes the requested action", async () => {
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: Record<string, unknown>,
        callback: (
          error: Error | null,
          stdout?: string,
          stderr?: string,
        ) => void,
      ) => {
        callback(null, "## main\n M src/tools/git.ts\n", "");
      },
    );

    const { gitTool } = await import("./git.js");
    const output = await gitTool.run({ action: " STATUS " });

    expect(output).toBe("Git status:\n## main\n M src/tools/git.ts");
    expect(execFileMock).toHaveBeenCalledWith(
      "git",
      ["status", "--short", "--branch"],
      expect.objectContaining({
        cwd: process.cwd(),
        maxBuffer: 2 * 1024 * 1024,
      }),
      expect.any(Function),
    );
  });

  it("formats branch output when git returns no current branch name", async () => {
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: Record<string, unknown>,
        callback: (
          error: Error | null,
          stdout?: string,
          stderr?: string,
        ) => void,
      ) => {
        callback(null, "", "");
      },
    );

    const { gitTool } = await import("./git.js");
    const output = await gitTool.run({ action: "branch" });

    expect(output).toBe("Current branch: unavailable.");
  });

  it("returns contextual failures for git command errors", async () => {
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: Record<string, unknown>,
        callback: (
          error: Error | null,
          stdout?: string,
          stderr?: string,
        ) => void,
      ) => {
        callback(
          new Error("Command failed"),
          "",
          "fatal: not a git repository (or any of the parent directories): .git\n",
        );
      },
    );

    const { gitTool } = await import("./git.js");
    const output = await gitTool.run({ action: "diff" });

    expect(output).toBe(
      "Git diff failed: fatal: not a git repository (or any of the parent directories): .git",
    );
  });

  it("rejects unsupported actions with the supported list", async () => {
    const { gitTool } = await import("./git.js");
    const output = await gitTool.run({ action: "merge" });

    expect(output).toBe(
      "Unsupported git action: merge. Supported actions: status, diff, log, branch, remote.",
    );
    expect(execFileMock).not.toHaveBeenCalled();
  });
});
