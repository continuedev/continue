import * as ideUtils from "core/util/ideUtils";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolExtras } from "./callClientTool";
import { editToolImpl } from "./editImpl";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid"),
}));

vi.mock("core/util/ideUtils", () => ({
  resolveRelativePathInDir: vi.fn(),
}));

vi.mock("../../redux/thunks/handleApplyStateUpdate", () => ({
  applyForEditTool: vi.fn(),
}));

describe("editToolImpl", () => {
  let mockExtras: ClientToolExtras;
  let mockResolveRelativePathInDir: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveRelativePathInDir = vi.mocked(ideUtils.resolveRelativePathInDir);
    mockResolveRelativePathInDir.mockResolvedValue("/test/file.txt");
    mockExtras = {
      getState: vi.fn() as any,
      dispatch: vi.fn() as any,
      ideMessenger: {
        ide: {
          readFile: vi
            .fn()
            .mockResolvedValue(Array(20).fill("existing").join("\n")),
        },
        request: vi.fn(),
      } as any,
    };
  });

  it("rejects a short unanchored replacement of a large file", async () => {
    await expect(
      editToolImpl(
        { filepath: "file.txt", changes: "replacement\ncontents" },
        "tool-call-id",
        mockExtras,
      ),
    ).rejects.toThrow("must contain anchor markers");
  });

  it("accepts lazy-anchored edits", async () => {
    await expect(
      editToolImpl(
        {
          filepath: "file.txt",
          changes: "// ... existing code ...\nreplacement",
        },
        "tool-call-id",
        mockExtras,
      ),
    ).resolves.toMatchObject({ respondImmediately: false });
  });

  it("allows a complete replacement when explicitly requested", async () => {
    await expect(
      editToolImpl(
        {
          filepath: "file.txt",
          changes: "replacement",
          overwrite: true,
        },
        "tool-call-id",
        mockExtras,
      ),
    ).resolves.toMatchObject({ respondImmediately: false });

    expect(mockExtras.ideMessenger.ide.readFile).not.toHaveBeenCalled();
  });
});
